import convert from "color-convert";
import {generateCanvas, setColorScheme} from "./utils/visuals";
import {fadeOut} from "./utils/fader";
import {modifyAlbumMediaSession, setAlbumMediaSession} from "./utils/media-sessions";
import {albumAudio} from "./utils/audios";
import {updateAudio} from "./utils/frequent-updates";
import {acquireWakeLock} from "./utils/wake-lock";

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

albumAudio(album, albumData, transitioning, index, audio, source, wakeLock, allButtons, volume, volumeSlider, fadeInInterval);
source.addEventListener("error", async () => {
  fetch(`/${genre}/${album}/regenerate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "song_index": index
    })
  }).then((response) => response.json())
    .then((data) => {
      if (data.url === "") {
        index++;
        updateAudio(album, albumData, audio, source, transitioning, index, allButtons);
      }
    });
});
listContainer.addEventListener("click", async (event) => {
  const button = event.target.closest(".song-button");
  if (button) {
    await fadeOut(audio);
    audio.currentTime = 0;
    index = allButtons.indexOf(button);
    await updateAudio(album, albumData, audio, source, transitioning, index, allButtons);
  }
});
document.addEventListener("visibilitychange", async () => {
  if (wakeLock === null && document.visibilityState === "visible") {
    await acquireWakeLock(wakeLock);
  }
});
fetch(`albums`)
  .then((response) => response.json())
  .then(async (data) => {
    albumData = data;
    await updateAudio(album, albumData, audio, source, transitioning, index, allButtons);
    setColorScheme(convert.rgb.hsv(data.albums[album].colors[0]),
      convert.rgb.hsv(data.albums[album].colors[1]),
      convert.rgb.hsv(data.albums[album].colors[2]));
    if ("mediaSession" in navigator) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const canvas = generateCanvas(image);
        try {
          cover = canvas.toDataURL("image/jpeg");
        } catch (error) {

          // noinspection JSUnresolvedVariable
          cover = data.albums[album].thumbnail;
        }
        setAlbumMediaSession(album, albumData, transitioning, index, audio, source, allButtons, cover);
      };

      // noinspection JSUnresolvedVariable
      image.src = data.albums[album].thumbnail;
      modifyAlbumMediaSession(audio);
    }
  });
if (window.history.replaceState) window.history.replaceState(null, null, window.location.href);
volumeSlider.style.setProperty("--slider-progress", "100%");
