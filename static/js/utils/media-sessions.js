import {fadeOut} from "./fader";
import {generateCanvas} from "./visuals";
import {updateAudio} from "./frequent-updates";

export function setGenreMediaSession(genre, data, audio, wakeLock, lastTime) {
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
          const canvas = generateCanvas(image);
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
}

export function setAlbumMediaSession(album, albumData, transitioning, index, audio, source, allButtons, cover) {

  // noinspection JSUnresolvedVariable
  if (cover) navigator.mediaSession.metadata = new MediaMetadata({
    title: albumData.albums[album].songs[index][0],
    artist: albumData.albums[album].artist_name.toLowerCase(),
    album: album.toLowerCase(),
    artwork: [
      {src: cover, sizes: "96x96", type: "image/jpeg"},
      {src: cover, sizes: "512x512", type: "image/jpeg"}
    ]
  });
  navigator.mediaSession.setActionHandler("nexttrack", async () => {
    if (transitioning) return;
    if (index < albumData.albums[album].songs.length - 1) {
      transitioning = true;
      audio.pause();
      await fadeOut(audio);
      audio.currentTime = 0;
      index++;
      await updateAudio(album, albumData, audio, source, transitioning, index, allButtons);
      navigator.mediaSession.playbackState = "playing";
      transitioning = false;
    }
  });

  navigator.mediaSession.setActionHandler("previoustrack", async () => {
    if (transitioning) return;
    if (index > 0) {
      transitioning = true;
      audio.pause();
      await fadeOut(audio);
      audio.currentTime = 0;
      index--;
      await updateAudio(album, albumData, audio, source, transitioning, index, allButtons);
      navigator.mediaSession.playbackState = "playing";
      transitioning = false;
    }
  });
}

export function modifyAlbumMediaSession(audio) {
  navigator.mediaSession.setActionHandler("play", () => {
    audio.play();
  });
  navigator.mediaSession.setActionHandler("pause", async () => {
    if (document.visibilityState === "visible") {
      while (audio.volume > 0.25) {
        audio.volume -= 0.25;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    audio.pause();
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
