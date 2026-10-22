import convert from "color-convert";

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
  if (wakeLock !== null) {
    wakeLock.release()
      .then(() => {
        wakeLock = null;
      });
  }
}

function setMediaSession() {

  // noinspection JSUnresolvedVariable
  navigator.mediaSession.metadata = new MediaMetadata({
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
      await fadeOut();
      audio.currentTime = 0;
      index++;
      await updateAudio();
      navigator.mediaSession.playbackState = "playing";
      transitioning = false;
    }
  });

  navigator.mediaSession.setActionHandler("previoustrack", async () => {
    if (transitioning) return;
    if (index > 0) {
      transitioning = true;
      audio.pause();
      await fadeOut();
      audio.currentTime = 0;
      index--;
      await updateAudio();
      navigator.mediaSession.playbackState = "playing";
      transitioning = false;
    }
  });
}

async function updateAudio() {
  if ("mediaSession" in navigator && albumData.albums[album]) setMediaSession();

  async function validateAudio() {
    const newUrl = albumData.albums[album].songs[index][1];
    if (newUrl === "") return false;
    allButtons.forEach(button => button.classList.remove("active"));
    if (allButtons[index]) allButtons[index].classList.add("active");
    source.src = newUrl;
    audio.load();
    audio.play();
    return true;
  }

  while (index < albumData.albums[album].songs.length) {
    if (await validateAudio()) break;
    index++;
  }
  if (index === albumData.albums[album].songs.length) {
    allButtons.forEach(button => button.classList.remove("active"));
  }
}

async function fadeOut() {
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
    await fadeOut();
    audio.currentTime = 0;
    index++;
    if (index < albumData.albums[album].songs.length) {
      await updateAudio();
    } else {
      releaseWakeLock();
    }
    transitioning = false;
  }
});
audio.addEventListener("ended", async () => {
  if (transitioning) return;
  transitioning = true;
  index++;
  if (index < albumData.albums[album].songs.length) {
    await updateAudio();
  } else {
    releaseWakeLock();
  }
  transitioning = false;
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
});
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
        updateAudio();
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
  if (wakeLock === null && document.visibilityState === "visible") {
    await acquireWakeLock();
  }
});
fetch(`albums`)
  .then((response) => response.json())
  .then(async (data) => {
    albumData = data;
    await updateAudio();
    const backgroundHsv = convert.rgb.hsv(data.albums[album].colors[0]);
    const primaryHsv = convert.rgb.hsv(data.albums[album].colors[1]);
    const secondaryHsv = convert.rgb.hsv(data.albums[album].colors[2]);
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
      `#${convert.rgb.hex(backgroundR * 2.314, backgroundG * 2.314, backgroundB * 2.314)}`);
    if ("mediaSession" in navigator) {
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
        try {
          cover = canvas.toDataURL("image/jpeg");
        } catch (error) {

          // noinspection JSUnresolvedVariable
          cover = data.albums[album].thumbnail;
        }
        setMediaSession();
      };

      // noinspection JSUnresolvedVariable
      image.src = data.albums[album].thumbnail;
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
  });
if (window.history.replaceState) window.history.replaceState(null, null, window.location.href);
volumeSlider.style.setProperty("--slider-progress", "100%");
