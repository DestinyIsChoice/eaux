import {acquireWakeLock} from "./utils/wake-lock";
import {genreAudio} from "./utils/audios";
import {updateCarouselSizing, updateContent} from "./utils/frequent-updates";

const audio = document.getElementById("audio");
const carousel = document.getElementById("carousel-track");
const carouselDivider = document.getElementById("carousel-divider");
const closePopupButton = document.getElementById("closePopup");
const genre = document.getElementById("genre").dataset.genre;
const list = document.getElementById("list");
const popupOverlay = document.getElementById("popupOverlay");
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

function hidePopup() {
  popupOverlay.classList.remove("show");
}

function showPopup(titleText, messageText) {
  if (titleText) document.getElementById('popup-title').textContent = titleText;
  if (messageText) document.getElementById('popup-message').textContent = messageText;
  popupOverlay.classList.add("show");
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

async function reloadlessSubmit(form, value, event, validator) {
  const formData = new FormData(form);
  event.preventDefault();
  formData.append(value, "clicked");
  formData.append("initial-load", "false");
  if (await validator()) {
    fetch(window.location.href, {
      method: "POST",
      body: formData
    })
      .then(response => {
        if (response.ok) {
          form.reset();
          form.classList.remove("show");
          updateContent(genre, audio, source, wakeLock, lastTime, list, carousel, carouselDivider);
        }
      });
  }
}

webWorker.onmessage = function (event) {
  if (event.data === "tick") updateContent(genre, audio, source, wakeLock, lastTime, list, carousel, carouselDivider);
};
document.addEventListener("visibilitychange", async () => {
  webWorker.postMessage("start");
  if (wakeLock === null && document.visibilityState === "visible") await acquireWakeLock(wakeLock);
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
      && event.target !== songTrigger) {
      songForm.classList.remove("show");
    }
    if (carouselContainer.classList.contains("form-active")
      && !carouselContainer.contains(event.target)
      && event.target !== albumTrigger) {
      carouselContainer.classList.remove("form-active");
      setTimeout(() => {
        updateCarouselSizing(carousel, carouselDivider)
      }, 200);
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
    const lastUserSong = JSON.parse(localStorage.getItem(`last_submitted_song_${genre}`));
    const submittedArtistName = formData.get("artist-search").toLowerCase();
    const submittedSongName = formData.get("song-search").toLowerCase();

    // noinspection ES6MissingAwait
    reloadlessSubmit(songForm, "song-submit", event, async () => {
      const queue_data = await (await fetch(`/${genre}/queue`)).json();
      const data = await (await fetch("/validate-song", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({song: submittedSongName, artist: submittedArtistName})
      })).json();
      if (lastUserSong) {

        // noinspection JSUnresolvedVariable
        if (queue_data.queue.some(song =>
          song.song_name.toLowerCase() === lastUserSong.song.toLowerCase() &&
          song.artist_name.toLowerCase() === lastUserSong.artist.toLowerCase()
        )) {
          showPopup("cannot submit song", "you have another song in queue!");
          submitButton.disabled = true;
          return false;
        }
      }
      if (data.song === null) {
        event.preventDefault();
        showPopup("cannot submit song", "cannot find song!");
        submitButton.disabled = true;
        return false;
      }
      if (queue_data.queue.length >= document.getElementById("max").dataset.max) {
        showPopup("cannot submit song", `${queue_data.queue.length} songs already in queue!`);
        submitButton.disabled = true;
        return false;
      }

      // noinspection JSUnresolvedVariable
      if (queue_data.queue.some(song =>
        song.song_name.toLowerCase() === data.song[0].toLowerCase() &&
        song.artist_name.toLowerCase() === data.song[1].toLowerCase()
      )) {
        showPopup("cannot submit song", "song already in queue!");
        submitButton.disabled = true;
        return false;
      }
      localStorage.setItem(`last_submitted_song_${genre}`, JSON.stringify({
        song: data.song[0],
        artist: data.song[1]
      }));
      return true;
    });
  });
  albumForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(albumForm);
    const today = new Date().toISOString().split("T")[0];
    document.querySelector(".album-submit").disabled = true;
    if (localStorage.getItem(`last_album_submission_date_${genre}`) === today) {
      showPopup("cannot submit album", "already submitted an album today!");
      return false;
    }
    fetch("/validate-album", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        album: formData.get("album-search").trim(),
        artist: formData.get("artist-search").trim()
      })
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.album === null) {
          showPopup("cannot submit album", "cannot find album!");
          return false;
        }

        // noinspection JSIgnoredPromiseFromCall
        reloadlessSubmit(albumForm, "album-submit", event, async () => {
          const albumsData = await (await fetch(`/${genre}/albums`)).json();
          if (albumsData.albums && Object.keys(albumsData.albums)
            .map(album => album.toLowerCase())
            .includes(data.album[0].toLowerCase())) {
            showPopup("cannot submit album", "album already submitted!");
            return false;
          }
          localStorage.setItem(`last_album_submission_date_${genre}`, today);
          return true;
        });
      }).catch(err => console.error("Error during validation:", err));
  });
});
genreAudio(genre, audio, source, volume, volumeSlider, fadeInInterval, wakeLock, transitioning, lastTime, list, albumsResponse, carousel, carouselDivider);
closePopupButton.addEventListener("click", hidePopup);
popupOverlay.addEventListener("click", (event) => {
  if (event.target === popupOverlay) {
    hidePopup();
  }
});
updateContent(genre, audio, source, wakeLock, lastTime, list, carousel, carouselDivider);
window.addEventListener("resize", () => {
  updateCarouselSizing(carousel, carouselDivider)
});
if (window.history.replaceState) window.history.replaceState(null, null, window.location.href);
webWorker.postMessage("start");
