import {fadeOut} from "./fader";
import {setAlbumMediaSession} from "./media-sessions";
import {updateAudio, updateContent} from "./frequent-updates";
import {acquireWakeLock} from "./wake-lock";

function setupVolumeSlider(volumeSlider, audio, volume) {
  volumeSlider.addEventListener("input", (event) => {
    const val = event.target.value;
    volume = Math.pow(val / 100, 3);
    audio.volume = volume;
    volumeSlider.style.setProperty("--slider-progress", `${val}%`);
  });
}

export function genreAudio(genre, audio, source, volume, volumeSlider, fadeInInterval, wakeLock, transitioning, lastTime, list, albumsResponse, carousel, carouselDivider) {
  setupVolumeSlider(volumeSlider, audio, volume);
  audio.addEventListener("play", async () => {
    clearInterval(fadeInInterval);
    if (document.visibilityState === "visible") {
      audio.volume = 0;
      if (wakeLock === null) await acquireWakeLock(wakeLock);
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
      updateContent(genre, audio, source, wakeLock, lastTime, list, carousel, carouselDivider);
      navigator.mediaSession.playbackState = "playing";
    }
  });
  audio.addEventListener("timeupdate", async () => {
    lastTime = audio.currentTime;
    if (!audio.duration || transitioning) return;
    if (audio.duration - audio.currentTime <= 1) {
      transitioning = true;
      await fadeOut(audio);
      audio.currentTime = 0;
      transitioning = false;
    }
  });
  audio.addEventListener("ended", async () => {
    if (transitioning) return;
    transitioning = true;
    audio.currentTime = 0;
    updateContent(genre, audio, source, wakeLock, lastTime, list, carousel, carouselDivider);
    transitioning = false;
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
  });
}

export function albumAudio(album, albumData, transitioning, index, audio, source, wakeLock, allButtons, volume, volumeSlider, fadeInInterval) {
  setupVolumeSlider(volumeSlider, audio, volume);
  audio.addEventListener("play", async () => {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    await acquireWakeLock(wakeLock);
    setAlbumMediaSession(album, albumData, transitioning, index, audio);
    clearInterval(fadeInInterval);
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
  audio.addEventListener("timeupdate", async () => {
    if (!audio.duration || transitioning) return;
    if (audio.duration - audio.currentTime <= 1) {
      transitioning = true;
      await fadeOut(audio);
      audio.currentTime = 0;
      index++;
      if (index < albumData.albums[album].songs.length) await updateAudio(album, albumData, audio, source, transitioning, index, allButtons);
      transitioning = false;
    }
  });
  audio.addEventListener("ended", async () => {
    if (transitioning) return;
    transitioning = true;
    index++;
    if (index < albumData.albums[album].songs.length) await updateAudio(album, albumData, audio, source, transitioning, index, allButtons);
    transitioning = false;
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
  });
}
