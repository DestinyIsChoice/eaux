import convert from "color-convert";

const audio = document.getElementById("audio");
const carousel = document.getElementById("carousel-track");
const carouselDivider = document.getElementById("carousel-divider");
const genre = document.getElementById("genre").dataset.genre;
const list = document.getElementById("list");
const source = document.getElementById("source");
const volumeSlider = document.getElementById("volume-slider");
const webWorker = new Worker(new URL("web-worker.js", import.meta.url));
let albumsResponse = null;
let currentScrollOffset = 0;
let fadeInInterval = null;
let isMoving = false;
let lastTime = 0;
let targetScrollOffset = 0;
let transitioning = false;
let volume = 1;
let wakeLock = null;
let startX = 0;
let isTouching = false;

async function acquireWakeLock() {
  if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
}

async function fadeOut() {
  while (audio.volume > 0.25) {
    audio.volume -= 0.25;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  audio.volume = 0;
}

function smoothAnimateScroll() {
  currentScrollOffset += (targetScrollOffset - currentScrollOffset) * 0.15;
  const duration = parseFloat(carousel.style.animationDuration);
  if (duration) carousel.style.animationDelay = `${-((currentScrollOffset % duration + duration) % duration)}s`;
  if (Math.abs(targetScrollOffset - currentScrollOffset) > 0.001) {
    requestAnimationFrame(smoothAnimateScroll);
  } else {
    currentScrollOffset = targetScrollOffset;
    isMoving = false;
  }
}

function updateCarouselSizing() {
  const containerWidth = document.getElementById("carousel-container").getBoundingClientRect().width;
  const duplicates = Array.from(carousel.querySelectorAll(".album-button.duplicate-slide"));
  const originals = Array.from(carousel.querySelectorAll(".album-button.original-slide"));
  const allButtons = [...originals, ...duplicates];
  if (originals.length === 0) return;

  allButtons.forEach(slide => slide.style.width = "auto");
  let totalOriginalsWidth = 0;
  originals.forEach((slide) => {
    totalOriginalsWidth += slide.offsetWidth
      + (parseFloat(window.getComputedStyle(slide).marginLeft) || 0)
      + (parseFloat(window.getComputedStyle(slide).marginRight) || 0);
  });
  if (carouselDivider) {
    totalOriginalsWidth += carouselDivider.offsetWidth
      + (parseFloat(window.getComputedStyle(carouselDivider).marginLeft) || 0)
      + (parseFloat(window.getComputedStyle(carouselDivider).marginRight) || 0);
  }
  if (totalOriginalsWidth + 140 <=
    (window.matchMedia("(pointer: coarse)").matches ? containerWidth / 2 : containerWidth)) {
    carousel.style.animation = "none";
    carousel.style.width = "100%";
    carousel.style.justifyContent = "center";
    duplicates.forEach(slide => slide.style.display = "none");
  } else {
    carousel.style.width = "max-content";
    carousel.style.justifyContent = "flex-start";
    duplicates.forEach((slide) => {
      slide.style.display = slide.classList.contains("entering") ? "none" : "block";
    });
    carousel.style.setProperty("--scroll-width", `${totalOriginalsWidth}px`);
    if (!carousel.style.animation || carousel.style.animation.includes("none")) {
      carousel.style.animation = `dynamicScroll ${totalOriginalsWidth / 100}s linear infinite`;
    } else {
      carousel.style.animationDuration = `${totalOriginalsWidth / 100}s`;
    }
  }
}

function updateContent() {
  fetch(`/${genre}/queue`)
    .then((response) => response.json())
    .then(async (data) => {
      const newUrl = data.queue.length !== 0
        ? `${data.queue[0].url}#t=${data.queue[0].timestamp}`
        : "";
      const oldUrl = source.src;
      source.src = newUrl;
      if (
        newUrl.slice(0, newUrl.indexOf("#")) !==
        oldUrl.slice(0, oldUrl.indexOf("#"))
      ) audio.load();
      const backgroundHsv = data.queue.length !== 0 ? convert.rgb.hsv(data.queue[0].colors[0]) : [229.41, 32.69, 20.39];
      const primaryHsv = data.queue.length !== 0 ? convert.rgb.hsv(data.queue[0].colors[1]) : [276.67, 31.3, 90.2];
      const secondaryHsv = data.queue.length !== 0 ? convert.rgb.hsv(data.queue[0].colors[2]) : [229.41, 32.69, 20.39];
      const [backgroundR, backgroundG, backgroundB] = convert.hsv.rgb(
        backgroundHsv[0], Math.min(backgroundHsv[1], 32.69), 20.39);
      document.documentElement.style.setProperty("--primary-color",
        `#${convert.hsv.hex(primaryHsv[0], Math.min(primaryHsv[1], 31.3), 90.2)}`);
      document.documentElement.style.setProperty("--secondary-color",
        `#${convert.hsv.hex(secondaryHsv[0], Math.min(secondaryHsv[1], 32.69), 20.39)}`);
      document.documentElement.style.setProperty("--background-0-color",
        `#${convert.rgb.hex(backgroundR, backgroundG, backgroundB)}`);
      document.documentElement.style.setProperty("--background-1-color",
        `#${convert.rgb.hex(backgroundR * 1.171, backgroundG * 1.171, backgroundB * 1.171)}`);
      document.documentElement.style.setProperty("--background-2-color",
        `#${convert.rgb.hex(backgroundR * 1.371, backgroundG * 1.371, backgroundB * 1.371)}`);
      document.documentElement.style.setProperty("--background-3-color",
        `#${convert.rgb.hex(backgroundR * 1.857, backgroundG * 1.857, backgroundB * 1.857)}`);
      document.documentElement.style.setProperty("--background-4-color",
        `#${convert.rgb.hex(backgroundR * 2.086, backgroundG * 2.086, backgroundB * 2.086)}`);
      document.documentElement.style.setProperty("--background-5-color",
        `#${convert.rgb.hex(backgroundR * 2.314, backgroundG * 2.314, backgroundB * 2.314)}`);

      // noinspection JSUnresolvedVariable
      const newHTML = data.queue
        .map(
          (song) =>
            `${song.song_name.toLowerCase()} - ${song.artist_name.toLowerCase()}<br>`,
        )
        .join("");
      if (newHTML === list.innerHTML) return;
      list.style.height = `${list.offsetHeight}px`;
      const clone = list.cloneNode(false);
      clone.style.visibility = "hidden";
      clone.style.position = "absolute";
      clone.style.height = "auto";
      clone.innerHTML = newHTML;
      list.parentNode.appendChild(clone);
      const targetHeight = clone.scrollHeight;
      clone.remove();
      list.innerHTML = newHTML;
      void list.offsetHeight;
      list.style.height = `${targetHeight}px`;
      if ("mediaSession" in navigator && data.queue.length !== 0) {
        new Promise(resolve => {
          const originalImage = new Image();
          originalImage.onload = () => {
            resolve([originalImage.naturalWidth, originalImage.naturalHeight]);
          };

          // noinspection JSUnresolvedVariable
          originalImage.src = data.queue[0].thumbnail;
        }).then(() => {
          new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => {
              const width = image.naturalWidth;
              const height = image.naturalHeight;
              if (!width || !height) return;
              const canvas = document.createElement("canvas");
              canvas.width = 512;
              canvas.height = 512;
              const size = Math.min(width, height);
              const startX = (width - size) / 2;
              const startY = (height - size) / 2;
              canvas.getContext("2d").drawImage(
                image,
                startX, startY, size, size,
                0, 0, 512, 512
              );
              resolve(canvas.toDataURL("image/png"));
            };

            // noinspection JSUnresolvedVariable
            image.src = data.queue[0].thumbnail;
          }).then(imageURL => {

            // noinspection JSCheckFunctionSignatures, JSUnresolvedVariable
            navigator.mediaSession.metadata = new MediaMetadata({
              title: data.queue[0].song_name.toLowerCase(),
              artist: data.queue[0].artist_name.toLowerCase(),
              artwork: [
                {src: imageURL, sizes: "96x96", type: "image/png"},
                {src: imageURL, sizes: "512x512", type: "image/png"}
              ]
            });
          });
        })
        navigator.mediaSession.setActionHandler("play", () => {
          fetch(`/${genre}/queue`)
            .then((response) => response.json())
            .then((data) => {
              audio.currentTime = data.queue[0].timestamp;
            });
          audio.play();
          navigator.mediaSession.playbackState = "playing";
        });
        navigator.mediaSession.setActionHandler("pause", async () => {
          if (wakeLock === null && document.visibilityState === "visible") await fadeOut();
          audio.pause();
          navigator.mediaSession.playbackState = "paused";
        });
        navigator.mediaSession.setActionHandler("seekbackward", () => {
          audio.currentTime = lastTime;
        });
        navigator.mediaSession.setActionHandler("seekforward", () => {
          audio.currentTime = lastTime;
        });
        navigator.mediaSession.setActionHandler("seekto", () => {
          audio.currentTime = lastTime;
        });
      }
    });
  fetch(`/${genre}/albums`)
    .then((response) => response.json())
    .then((data) => {
      if (albumsResponse && JSON.stringify(Object.keys(albumsResponse.albums)) === JSON.stringify(Object.keys(data.albums))) return;
      const carouselContainer = document.querySelector(".carousel-container");
      carouselContainer.classList.remove("form-active");
      carouselContainer.classList.add("container-fading");
      setTimeout(() => {
        for (const album of Object.keys(data.albums)) {
          if (!albumsResponse || !Object.hasOwn(albumsResponse.albums, album)) {
            const albumButton = document.createElement("a");
            const albumButtonAriaHidden = document.createElement("a");
            albumButton.href = `/${genre}/${album}`;
            albumButton.className = "album-button original-slide";

            // noinspection JSUnresolvedVariable
            albumButton.textContent = `${album} - ${data.albums[album].artist_name}`;
            albumButtonAriaHidden.href = `/${genre}/${album}`;
            albumButtonAriaHidden.className = "album-button duplicate-slide";
            albumButtonAriaHidden.ariaHidden = "true";

            // noinspection JSUnresolvedVariable
            albumButtonAriaHidden.textContent = `${album} - ${data.albums[album].artist_name}`;
            albumButtonAriaHidden.style.display = "none";
            carouselDivider.before(albumButton);
            carousel.append(albumButtonAriaHidden);
          }
        }
        albumsResponse = data;
        carouselContainer.classList.remove("container-fading");
        updateCarouselSizing();
      }, 300);
    });
}

async function reloadlessSubmit(form, value, event, validator) {
  const formData = new FormData(form);
  event.preventDefault();
  formData.append(value, "clicked");
  if (await validator()) {
    fetch(window.location.href, {
      method: "POST",
      body: formData
    })
      .then(response => {
        if (response.ok) {
          form.reset();
          form.classList.remove("show");
          updateContent();
        }
      });
  }
}

webWorker.onmessage = function (event) {
  if (event.data === "tick") updateContent();
};
document.addEventListener("visibilitychange", async () => {
  webWorker.postMessage("start");
  if (wakeLock === null && document.visibilityState === "visible") await acquireWakeLock();
});
document.addEventListener("DOMContentLoaded", () => {
  const albumForm = document.getElementById("album-form");
  const albumTrigger = document.querySelector(".album-form-dropdown-trigger");
  const carouselContainer = document.getElementById("carousel-container");
  const songForm = document.getElementById("song-form");
  const songTrigger = document.querySelector(".song-form-dropdown-trigger");

  function validateForm(inputClass, submitClass) {
    let incomplete = false;
    document.querySelectorAll(inputClass).forEach(input => {
      if (input.value === "") incomplete = true;
    });
    document.querySelector(submitClass).textContent = "submit";
    document.querySelector(submitClass).disabled = incomplete;
  }

  carouselContainer.addEventListener("wheel", (event) => {
    if (carousel.style.animation && carousel.style.animation !== "none") {
      event.preventDefault();
      targetScrollOffset += event.deltaY * 0.01;
      if (!isMoving) {
        isMoving = true;
        requestAnimationFrame(smoothAnimateScroll);
      }
    }
  }, {passive: false});
  carouselContainer.addEventListener("touchstart", (event) => {
    if (carousel.style.animation && carousel.style.animation !== "none") {
      isTouching = true;
      startX = event.touches[0].clientX;
    }
  }, {passive: true});
  carouselContainer.addEventListener("touchmove", (event) => {
    if (!isTouching || !carousel.style.animation || carousel.style.animation === "none") return;
    const currentX = event.touches[0].clientX;
    const deltaX = startX - currentX;
    startX = currentX;
    if (event.cancelable) event.preventDefault();
    targetScrollOffset += deltaX * 0.005;
    if (!isMoving) {
      isMoving = true;
      requestAnimationFrame(smoothAnimateScroll);
    }
  }, {passive: false});
  carouselContainer.addEventListener("touchend", () => {
    isTouching = false;
  }, {passive: true});
  document.addEventListener("click", (event) => {
    if (songForm.classList.contains("show")
      && !songForm.contains(event.target)
      && event.target !== songTrigger) songForm.classList.remove("show");
    if (carouselContainer.classList.contains("form-active")
      && !carouselContainer.contains(event.target)
      && event.target !== albumTrigger) {
      carouselContainer.classList.remove("form-active");
      setTimeout(updateCarouselSizing, 200);
    }
  });
  songTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (carouselContainer) carouselContainer.classList.remove("form-active");
    songForm.classList.toggle("show");
  });
  document.querySelectorAll(".song-input").forEach(input => {
    input.addEventListener("input", () => validateForm(".song-input", ".song-submit"));
  });
  albumTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (songForm) songForm.classList.remove("show");
    carouselContainer.classList.toggle("form-active");
  });
  document.querySelectorAll(".album-input").forEach(input => {
    input.addEventListener("input", () => {
      validateForm(".album-input", ".album-submit");
      document.querySelector(".album-submit").textContent = "submit";
    });
  });
  songForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = document.querySelector(".song-submit");
    if (submitButton) submitButton.disabled = true;
    const formData = new FormData(songForm);
    const submittedArtistName = formData.get("artist-search").toLowerCase();
    const submittedSongName = formData.get("song-search").toLowerCase();

    async function validateAndQueue() {
      const data = await (await fetch(`/${genre}/queue`)).json();
      const lastUserSong = JSON.parse(localStorage.getItem(`last_submitted_song_${genre}`));
      if (lastUserSong) {

        // noinspection JSUnresolvedVariable
        if (data.queue.some(song =>
          song.song_name.toLowerCase() === lastUserSong.song.toLowerCase() &&
          song.artist_name.toLowerCase() === lastUserSong.artist.toLowerCase()
        )) {
          submitButton.textContent = "you have another song in queue!";
          submitButton.disabled = true;
          return false;
        }
      }
      localStorage.setItem(`last_submitted_song_${genre}`, JSON.stringify({
        song: submittedSongName,
        artist: submittedArtistName
      }));
      if (data.queue.length >= document.getElementById("max").dataset.max) {
        submitButton.textContent = `${data.queue.length} songs already in queue!`;
        submitButton.disabled = true;
        return false;
      }

      // noinspection JSUnresolvedVariable
      if (data.queue.some(song =>
        song.song_name.toLowerCase() === submittedSongName &&
        song.artist_name.toLowerCase() === submittedArtistName
      )) {
        submitButton.textContent = "song already in queue!";
        submitButton.disabled = true;
        return false;
      }
      return true;
    }

    await reloadlessSubmit(songForm, "song-submit", event, validateAndQueue);
  });
  albumForm.addEventListener("submit", (event) => {
    const today = new Date().toISOString().split("T")[0];
    if (localStorage.getItem(`last_album_submission_date_${genre}`) === today) {
      event.preventDefault();
      const submitButton = document.querySelector(".album-submit");
      submitButton.textContent = "already submitted an album today!";
      submitButton.disabled = true;
      return;
    }

    // noinspection JSIgnoredPromiseFromCall
    reloadlessSubmit(albumForm, "album-submit", event, async () => {
      if (Object.keys((await (await fetch(`/${genre}/albums`)).json()).albums)
        .map(album => album.toLowerCase())
        .includes(new FormData(albumForm).get("album-search").toLowerCase())) {
        document.querySelector(".album-submit").textContent = `album already submitted!`;
        return false;
      }
      localStorage.setItem(`last_album_submission_date_${genre}`, today);
      return true;
    });
    document.querySelector(".album-submit").disabled = true;
  });
});
if (volumeSlider && audio) {
  volumeSlider.addEventListener("input", (event) => {
    const val = event.target.value;
    volume = Math.pow(val / 100, 3);
    audio.volume = volume;
    volumeSlider.style.setProperty("--slider-progress", `${val}%`);
  });
}
audio.addEventListener("play", async () => {
  clearInterval(fadeInInterval);
  if (document.visibilityState === "visible") {
    audio.volume = 0;
    if (wakeLock === null) await acquireWakeLock();
    fadeInInterval = setInterval(() => {
      if (audio.volume < volume - 0.05) {
        audio.volume += 0.05;
      } else {
        audio.volume = volume;
        clearInterval(fadeInInterval);
      }
    }, 50);
  } else {
    audio.volume = 1;
  }
  if ("mediaSession" in navigator) {
    updateContent();
    navigator.mediaSession.playbackState = "playing";
  }
});
audio.addEventListener("timeupdate", async () => {
  lastTime = audio.currentTime;
});
audio.addEventListener("ended", async () => {
  if (transitioning) return;
  transitioning = true;
  audio.currentTime = 0;
  updateContent();
  transitioning = false;
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
});
updateContent();
window.addEventListener("resize", updateCarouselSizing);
if (window.history.replaceState) window.history.replaceState(null, null, window.location.href);
webWorker.postMessage("start");
