import convert from "color-convert";

const audio = document.getElementById("audio");
const carousel = document.getElementById("carousel-track");
const carouselDivider = document.getElementById("carousel-divider");
const genre = document.getElementById("genre").dataset.genre;
const list = document.getElementById("list");
const source = document.getElementById("source");
const volumeSlider = document.getElementById("volume-slider");
let albumsResponse = null;
let volume = 1;

function reloadlessSubmit(form, value, event) {
  const formData = new FormData(form);
  event.preventDefault();
  formData.append(value, "clicked");
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
    })
    .catch(error => console.error("Error submitting song:", error));
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
    totalOriginalsWidth += slide.getBoundingClientRect().width + 16;
  });
  if (totalOriginalsWidth + 40 <= containerWidth) {
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
    .then((data) => {
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
        updateCarouselSizing();
        carouselContainer.classList.remove("container-fading");
        updateCarouselSizing();
      }, 300);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const albumForm = document.getElementById("album-form");
  const albumTrigger = document.querySelector(".album-form-dropdown-trigger");
  const carouselContainer = document.getElementById("carousel-container");
  const songForm = document.getElementById("song-form");
  const songTrigger = document.querySelector(".song-form-dropdown-trigger");
  let currentScrollOffset = 0;
  let isMoving = false;
  let targetScrollOffset = 0;

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

  if (carouselContainer) {
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
  }
  if (songTrigger && songForm) {
    songTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (carouselContainer) carouselContainer.classList.remove("form-active");
      songForm.classList.toggle("show");
    });
  }
  if (albumTrigger && carouselContainer && albumForm) {
    albumTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (songForm) songForm.classList.remove("show");
      carouselContainer.classList.toggle("form-active");
    });
  }
  document.addEventListener("click", (event) => {
    if (songForm
      && songForm.classList.contains("show")
      && !songForm.contains(event.target)
      && event.target !== songTrigger) songForm.classList.remove("show");
    if (carouselContainer
      && carouselContainer.classList.contains("form-active")
      && !carouselContainer.contains(event.target)
      && event.target !== albumTrigger) {
      carouselContainer.classList.remove("form-active");
      setTimeout(updateCarouselSizing, 200);
    }
  });
  songForm.addEventListener("submit", (event) => {
    reloadlessSubmit(songForm, "song-submit", event);
  });
  albumForm.addEventListener("submit", (event) => {
    reloadlessSubmit(albumForm, "album-submit", event);
  });
});
if (volumeSlider && audio) {
  volumeSlider.addEventListener("input", (event) => {
    const val = event.target.value;
    volume = Math.pow(val / 100, 2);
    audio.volume = volume;
    volumeSlider.style.setProperty("--slider-progress", `${val}%`);
  });
}
updateContent();
window.addEventListener("resize", updateCarouselSizing);
if (window.history.replaceState) window.history.replaceState(null, null, window.location.href);
setInterval(updateContent, 1000);
