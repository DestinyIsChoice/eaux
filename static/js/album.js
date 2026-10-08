import convert from "color-convert";

const album = document.getElementById("album").dataset.genre;
const audio = document.getElementById("audio");
const listContainer = document.querySelector(".list-container");
const source = document.getElementById("source");
let albumData = {
  albums: {
    songs: [""]
  }
};
let index = 0;

function getAlbum() {
  fetch(`albums`)
    .then((response) => response.json())
    .then((data) => {
      albumData = data;
      source.src = data.albums[album].songs[0][1];
      audio.load();
      if (!audio.paused) {
        audio.play().catch(() => {
        });
      }
      listContainer.querySelectorAll(".song-button")[0].classList.add("active");
      const primaryHsv = convert.rgb.hsv(data.albums[album].colors[1]);
      const secondaryHsv = convert.rgb.hsv(data.albums[album].colors[2]);
      const backgroundHsv = convert.rgb.hsv(data.albums[album].colors[0]);
      const [backgroundR, backgroundG, backgroundB] = convert.hsv.rgb(
        backgroundHsv[0], Math.min(backgroundHsv[1], 32.7), 20.4);
      document.documentElement.style.setProperty("--primary-color",
        `#${convert.hsv.hex(primaryHsv[0], Math.min(primaryHsv[1], 31.3), 90.2)}`);
      document.documentElement.style.setProperty("--secondary-color",
        `#${convert.hsv.hex(secondaryHsv[0], Math.min(secondaryHsv[1], 32.7), 20.4)}`);
      document.documentElement.style.setProperty("--background-0-color",
        `#${convert.rgb.hex(backgroundR, backgroundG, backgroundB)}`);
      document.documentElement.style.setProperty("--background-1-color",
        `#${convert.rgb.hex(backgroundR * 1.371, backgroundG * 1.371, backgroundB * 1.371)}`);
      document.documentElement.style.setProperty("--background-2-color",
        `#${convert.rgb.hex(backgroundR * 1.857, backgroundG * 1.857, backgroundB * 1.857)}`);
      document.documentElement.style.setProperty("--background-3-color",
        `#${convert.rgb.hex(backgroundR * 2.314, backgroundG * 2.314, backgroundB * 2.314)}`);
    });
}

if (window.history.replaceState) {
  window.history.replaceState(null, null, window.location.href);
}

getAlbum();

audio.addEventListener("ended", () => {
  let newUrl = "";
  if (index < albumData.albums[album].songs.length) {
    while (newUrl === "") {
      newUrl = albumData.albums[album].songs[++index][1];
    }
  }
  Array.from(listContainer.querySelectorAll(".song-button"))
    .forEach(button => button.classList.remove("active"));
  listContainer.querySelectorAll(".song-button")[index].classList.add("active");
  source.src = newUrl;
  audio.load();
  if (!audio.paused) {
    audio.play().catch(() => {
    });
  }
});

listContainer.addEventListener("click", (event) => {
  const button = event.target.closest(".song-button");
  if (button) {
    const allButtons = Array.from(listContainer.querySelectorAll(".song-button"));
    const buttonIndex = allButtons.indexOf(button);
    const newUrl = albumData.albums[album].songs[buttonIndex][1];
    if (newUrl !== "") {
      index = buttonIndex;
      allButtons.forEach(button => button.classList.remove("active"));
      button.classList.add("active");
      source.src = newUrl;
      audio.load();
      if (!audio.paused) {
        audio.play().catch(() => {
        });
      }
    }
  }
});
