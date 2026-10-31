import convert from "color-convert";
import {generateCanvas, setColorScheme} from "./utils";

const album = document.getElementById("album").dataset.album;
const genre = document.getElementById("genre").dataset.genre;
const audio = document.getElementById("audio");
const listContainer = document.querySelector(".list-container");
const allButtons = Array.from(listContainer.querySelectorAll(".song-button"));
const source = document.getElementById("source");
const volumeSlider = document.getElementById("volume-slider");
let albumData = {
  albums: {
    songs: [""]
  }
};
let cover = null;
let fadeInInterval = null;
let index = 0;
let transitioning = false;
let volume = 1;
let wakeLock = null;

async function acquireWakeLock() {
  if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
}

function releaseWakeLock() {
  if (wakeLock !== null) wakeLock.release().then(() => { wakeLock = null; });
}

function updateDOMActiveTrack() {
  if (document.visibilityState !== "visible") return;
  allButtons.forEach((button, idx) => {
    button.classList.toggle("active", idx === index);
  });
}

function setMediaSession() {
  if (!("mediaSession" in navigator) || !albumData.albums[album]) return;
  const currentSong = albumData.albums[album].songs[index];
  if (!currentSong) return;

  // noinspection JSUnresolvedReference
  navigator.mediaSession.metadata = new MediaMetadata({
    title: currentSong[0],
    artist: albumData.albums[album].artist_name.toLowerCase(),
    album: album.toLowerCase(),
    artwork: [
      {src: cover, sizes: "96x96", type: "image/jpeg"},
      {src: cover, sizes: "512x512", type: "image/jpeg"}
    ]
  });
}

function initMediaSessionHandlers() {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.setActionHandler("play", () => {
    audio.play();
  });
  navigator.mediaSession.setActionHandler("pause", () => {
    audio.pause();
  });
  navigator.mediaSession.setActionHandler("nexttrack", async () => {
    if (transitioning) return;
    if (index < albumData.albums[album].songs.length - 1) {
      transitioning = true;
      navigator.mediaSession.playbackState = "playing";
      audio.pause();
      index++;
      await updateAudio();
      transitioning = false;
    }
  });
  navigator.mediaSession.setActionHandler("previoustrack", async () => {
    if (transitioning) return;
    if (index > 0) {
      transitioning = true;
      navigator.mediaSession.playbackState = "playing";
      audio.pause();
      index--;
      await updateAudio();
      transitioning = false;
    }
  });
  navigator.mediaSession.setActionHandler("seekbackward", (event) => {
    audio.currentTime = Math.max(audio.currentTime - (event.seekOffset || 10), 0);
  });
  navigator.mediaSession.setActionHandler("seekforward", (event) => {
    audio.currentTime = Math.min(audio.currentTime + (event.seekOffset || 10), audio.duration);
  });
  navigator.mediaSession.setActionHandler("seekto", (event) => {
    if (event.fastSeek && "fastSeek" in audio) {
      audio.fastSeek(event.seekTime);
      return;
    }
    audio.currentTime = event.seekTime;
  });
}

async function updateAudio() {
  setMediaSession();
  updateDOMActiveTrack();

  async function validateAudio() {
    const song = albumData.albums[album].songs[index];
    if (!song) return false;
    source.src = song[1];
    audio.load();
    await audio.play();
    return true;
  }

  while (index < albumData.albums[album].songs.length) {
    if (await validateAudio()) break;
    index++;
  }
  if (index >= albumData.albums[album].songs.length) {
    if (document.visibilityState === "visible") allButtons.forEach(button => button.classList.remove("active"));
    releaseWakeLock();
  }
}

async function fadeOut() {
  if (document.visibilityState !== "visible") {
    audio.volume = 0;
    return;
  }
  while (audio.volume > 0.25) {
    audio.volume -= 0.25;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  audio.volume = 0;
}

audio.addEventListener("play", async () => {
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
  await acquireWakeLock();
  setMediaSession();
  clearInterval(fadeInInterval);
  if (document.visibilityState !== "visible") {
    audio.volume = volume;
    return;
  }
  audio.volume = 0;
  fadeInInterval = setInterval(() => {
    if (audio.volume < volume - 0.05) {
      audio.volume += 0.05;
    } else {
      audio.volume = volume;
      clearInterval(fadeInInterval);
    }
  }, 50);
});
audio.addEventListener("pause", () => {
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
});
audio.addEventListener("ended", async () => {
  if (transitioning) return;
  transitioning = true;
  index++;
  if (index < albumData.albums[album].songs.length) {
    await updateAudio();
  } else {
    releaseWakeLock();
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
  }
  transitioning = false;
});
source.addEventListener("error", async () => {
  fetch(`/${genre}/${album}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ "song_index": index })
  })
    .then((response) => response.json())
    .then(async (data) => {
      if (data.url === "") {
        index++;
        await updateAudio();
      } else {
        source.src = data.url;
        audio.load();
        await audio.play();
      }
    });
});
listContainer.addEventListener("click", async (event) => {
  const button = event.target.closest(".song-button");
  if (button) {
    await fadeOut();
    audio.currentTime = 0;
    index = allButtons.indexOf(button);
    await updateAudio();
  }
});
volumeSlider.addEventListener("input", (event) => {
  const val = event.target.value;
  volume = Math.pow(val / 100, 3);
  audio.volume = volume;
  volumeSlider.style.setProperty("--slider-progress", `${val}%`);
});
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    await acquireWakeLock();
    updateDOMActiveTrack();
  }
});
initMediaSessionHandlers();
fetch(`albums`)
  .then((response) => response.json())
  .then(async (data) => {
    albumData = data;
    const backgroundHsv = convert.rgb.hsv(data.albums[album].colors[0]);
    const primaryHsv = convert.rgb.hsv(data.albums[album].colors[1]);
    const secondaryHsv = convert.rgb.hsv(data.albums[album].colors[2]);
    setColorScheme(document, primaryHsv, secondaryHsv, backgroundHsv);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        cover = generateCanvas(image).toDataURL("image/jpeg");
      } catch (error) {

        // noinspection JSUnresolvedReference
        cover = data.albums[album].thumbnail;
      }
      setMediaSession();
    };

    // noinspection JSUnresolvedReference
    image.src = data.albums[album].thumbnail;
    await updateAudio();
  });
if (window.history.replaceState) window.history.replaceState(null, null, window.location.href);
volumeSlider.style.setProperty("--slider-progress", "100%");
