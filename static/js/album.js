import convert from "color-convert";

const album = document.getElementById("album").dataset.album;
const genre = document.getElementById("genre").dataset.genre;
const audio = document.getElementById("audio");
const listContainer = document.querySelector(".list-container");
const source = document.getElementById("source");
const volumeSlider = document.getElementById("volume-slider");
const allButtons = Array.from(listContainer.querySelectorAll(".song-button"));
let albumData = {
  albums: {
    songs: [""]
  }
};
let fadeInInterval = null;
let index = 0;
let volume = 1;

async function updateAudio() {

  async function validateAudio() {
    const newUrl = albumData.albums[album].songs[index][1];
    if (newUrl === "") return false;
    allButtons.forEach(button => button.classList.remove("active"));
    allButtons[index].classList.add("active");
    source.src = newUrl;
    audio.load();
    return true;
  }

  while (index < albumData.albums[album].songs.length) {
    if (await validateAudio()) break;
    index++;
  }
  if (index === albumData.albums[album].songs.length) allButtons.forEach(button => button.classList.remove("active"));
}

async function fadeOut() {
  while (audio.volume > 0.25) {
    audio.volume -= 0.25;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  audio.volume = 0;
}

audio.addEventListener("ended", async () => {
  index++;
  console.log(index);
  await updateAudio();
  console.log(index);
});
audio.addEventListener("timeupdate", async () => {
  if (!audio.duration) return;
  if (audio.duration - audio.currentTime <= 1) await fadeOut();
});
audio.addEventListener("play", () => {
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
      source.src = data.url;
      audio.load();
    });
});
listContainer.addEventListener("click", async (event) => {
  const button = event.target.closest(".song-button");
  if (button) {
    await fadeOut();
    index = allButtons.indexOf(button);
    await updateAudio();
  }
});
volumeSlider.addEventListener("input", (event) => {
  const val = event.target.value;
  volume = Math.pow(val / 100, 2);
  audio.volume = volume;
  volumeSlider.style.setProperty("--slider-progress", `${val}%`);
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
  });
if (window.history.replaceState) window.history.replaceState(null, null, window.location.href);
volumeSlider.style.setProperty("--slider-progress", "100%");
