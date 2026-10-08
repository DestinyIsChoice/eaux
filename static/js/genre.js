import convert from "color-convert";

const audio = document.getElementById("audio");
const genre = document.getElementById("genre").dataset.genre;
const list = document.getElementById("list");
const source = document.getElementById("source");

function updateContent() {
  fetch(`${genre}/queue`)
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
      ) {
        audio.load();
      }
      if (!audio.paused) {
        audio.play().catch(() => {});
      }
      const primaryHsv = data.queue.length !== 0 ? convert.rgb.hsv(data.queue[0].colors[1]) : [276.7, 31.3, 90.2];
      const secondaryHsv = data.queue.length !== 0 ? convert.rgb.hsv(data.queue[0].colors[2]) : [229.4, 32.7, 20.4];
      const backgroundHsv = data.queue.length !== 0 ? convert.rgb.hsv(data.queue[0].colors[0]) : [229.4, 32.7, 20.4];
      const [backgroundR, backgroundG, backgroundB] = convert.hsv.rgb(
        backgroundHsv[0], Math.min(backgroundHsv[1], 32.7), 20.4);
      document.documentElement.style.setProperty("--primary-color",
        `#${convert.hsv.hex(primaryHsv[0], Math.min(primaryHsv[1], 31.3), 90.2)}`);
      document.documentElement.style.setProperty("--secondary-color",
        `#${convert.hsv.hex(secondaryHsv[0], Math.min(secondaryHsv[1], 32.7), 20.4)}`);
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
      const newHTML = data.queue
        .map(
          (song) =>
            `${song.song_name.toLowerCase()}
                        - ${song.artist_name.toLowerCase()}
                        <br>`,
        )
        .join("");
      if (newHTML !== list.innerHTML) {
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
      }
    })
    .catch(() => {
    });
}

if (window.history.replaceState) {
  window.history.replaceState(null, null, window.location.href);
}

setInterval(updateContent, 1000);

document.addEventListener("DOMContentLoaded", () => {
  const songTrigger = document.querySelector(".song-form-dropdown-trigger");
  const albumTrigger = document.querySelector(".album-form-dropdown-trigger");
  const songForm = document.getElementById("song-form");
  const albumForm = document.getElementById("album-form");
  if (songTrigger && songForm) {
    songTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (albumForm) albumForm.classList.remove("show");
      songForm.classList.toggle("show");
    });
  }
  if (albumTrigger && albumForm) {
    albumTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (songForm) songForm.classList.remove("show");
      albumForm.classList.toggle("show");
    });
  }
  document.addEventListener("click", (event) => {
    const clickedTarget = event.target;
    if (songForm && songForm.classList.contains("show")) {
      if (!songForm.contains(clickedTarget) && clickedTarget !== songTrigger) {
        songForm.classList.remove("show");
      }
    }
    if (albumForm && albumForm.classList.contains("show")) {
      if (!albumForm.contains(clickedTarget) && clickedTarget !== albumTrigger) {
        albumForm.classList.remove("show");
      }
    }
  });
  songForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await fetch(`/${genre}`, {
      method: "POST",
      body: new FormData(songForm)
    });
  });
  albumForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await fetch(`/${genre}`, {
      method: "POST",
      body: new FormData(albumForm)
    });
  });
  const track = document.getElementById("carousel-track");
  const slides = Array.from(track.querySelectorAll('.album-button'));
  if (slides.length === 0) return;
  const gap = 16;
  const uniqueSlideCount = slides.length / 2;
  function setupCarouselSizing() {
    track.style.animation = "none";
    track.style.transform = "translateX(0)";
    slides.forEach((slide) => {
      slide.style.display = "block";
      slide.style.marginRight = `${gap}px`;
      slide.style.width = "auto";
    });
    let totalOriginalsWidth = 0;
    for (let i = 0; i < uniqueSlideCount; i++) {
      totalOriginalsWidth += slides[i].getBoundingClientRect().width + gap;
    }
    if (totalOriginalsWidth + 40
      <= document.getElementById("carousel-container").getBoundingClientRect().width) {
      track.style.width = "100%";
      track.style.justifyContent = "center";
      slides.forEach((slide, index) => {
        if (index >= uniqueSlideCount) {
          slide.style.display = "none";
        } else if (index === uniqueSlideCount - 1) {
          slide.style.marginRight = "0";
        }
      });
    } else {
      track.style.width = "max-content";
      track.style.justifyContent = "flex-start";
      const styleId = "dynamic-carousel-keyframes";
      let styleElement = document.getElementById(styleId);
      if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }
      const translationDistance = totalOriginalsWidth;
      styleElement.innerHTML = `
          @keyframes dynamicScroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-${translationDistance}px); }
          }
      `;
      const dynamicDuration = translationDistance / 100;
      track.style.animation = `dynamicScroll ${dynamicDuration}s linear infinite`;
    }
  }
  setupCarouselSizing();
  window.addEventListener("resize", setupCarouselSizing);
});
