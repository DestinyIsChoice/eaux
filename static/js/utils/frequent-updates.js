import {setAlbumMediaSession, setGenreMediaSession} from "./media-sessions";
import convert from "color-convert";
import {setColorScheme} from "./visuals";

let cachedAlbumsResponse = null;

export function updateContent(genre, audio, source, wakeLock, lastTime, list, carousel, carouselDivider) {
  fetch(`/${genre}/queue`)
    .then((response) => response.json())
    .then(async (data) => {
      const newUrl = data.queue.length !== 0
        ? `${data.queue[0].url}#t=${data.queue[0].timestamp}`
        : "";
      const oldUrl = source.src;
      source.src = newUrl;
      if (
        newUrl.slice(0, newUrl.indexOf("#")) !==
        oldUrl.slice(0, oldUrl.indexOf("#"))
      ) audio.load();
      setColorScheme(data.queue.length !== 0 ? convert.rgb.hsv(data.queue[0].colors[0]) : [192.22, 100, 21.18],
        data.queue.length !== 0 ? convert.rgb.hsv(data.queue[0].colors[1]) : [45.6, 10.5, 93.33],
        data.queue.length !== 0 ? convert.rgb.hsv(data.queue[0].colors[2]) : [192.22, 100, 21.18]);

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
      setGenreMediaSession(genre, data, audio, wakeLock, lastTime)
    });
  fetch(`/${genre}/albums`)
    .then((response) => response.json())
    .then((data) => {
      if (cachedAlbumsResponse && JSON.stringify(Object.keys(cachedAlbumsResponse.albums)) === JSON.stringify(Object.keys(data.albums))) return;
      const carouselContainer = document.querySelector(".carousel-container");
      carouselContainer.classList.remove("form-active");
      carouselContainer.classList.add("container-fading");
      setTimeout(() => {
        for (const album of Object.keys(data.albums)) {
          if (!cachedAlbumsResponse || !Object.hasOwn(cachedAlbumsResponse.albums, album)) {
            const albumButton = document.createElement("a");
            const albumButtonAriaHidden = document.createElement("a");
            albumButton.href = `/${genre}/${album}`;
            albumButton.className = "album-button original-slide";
            albumButton.textContent = `${album} - ${data.albums[album].artist_name}`;
            albumButtonAriaHidden.href = `/${genre}/${album}`;
            albumButtonAriaHidden.className = "album-button duplicate-slide";
            albumButtonAriaHidden.ariaHidden = "true";
            albumButtonAriaHidden.textContent = `${album} - ${data.albums[album].artist_name}`;
            albumButtonAriaHidden.style.display = "none";
            carouselDivider.before(albumButton);
            carousel.append(albumButtonAriaHidden);
          }
        }
        cachedAlbumsResponse = data;
        carouselContainer.classList.remove("container-fading");
        updateCarouselSizing(carousel, carouselDivider);
      }, 300);
    });
}

export async function updateAudio(album, albumData, audio, source, transitioning, index, allButtons, cover) {
  if ("mediaSession" in navigator && albumData.albums[album]) {
    setAlbumMediaSession(album, albumData, transitioning, index, audio, source, allButtons, cover);
  }

  async function validateAudio() {
    const newUrl = albumData.albums[album].songs[index][1];
    if (newUrl === "") return false;
    allButtons.forEach(button => button.classList.remove("active"));
    if (allButtons[index]) allButtons[index].classList.add("active");
    source.src = newUrl;
    audio.load();
    try {
      await audio.play();
    } catch (error) {
    }
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

export function updateCarouselSizing(carousel, carouselDivider) {
  const containerWidth = document.getElementById("carousel-container").getBoundingClientRect().width;
  const duplicates = Array.from(carousel.querySelectorAll(".album-button.duplicate-slide"));
  const originals = Array.from(carousel.querySelectorAll(".album-button.original-slide"));
  const allButtons = [...originals, ...duplicates];
  if (originals.length === 0) return;
  allButtons.forEach(slide => slide.style.width = "auto");
  let totalOriginalsWidth = 0;
  originals.forEach((slide) => {
    totalOriginalsWidth += slide.offsetWidth
      + (parseFloat(window.getComputedStyle(slide).marginLeft) || 0)
      + (parseFloat(window.getComputedStyle(slide).marginRight) || 0);
  });
  if (carouselDivider) {
    totalOriginalsWidth += carouselDivider.offsetWidth
      + (parseFloat(window.getComputedStyle(carouselDivider).marginLeft) || 0)
      + (parseFloat(window.getComputedStyle(carouselDivider).marginRight) || 0);
  }
  if (totalOriginalsWidth + 140 <=
    (window.matchMedia("(pointer: coarse)").matches ? containerWidth / 2 : containerWidth)) {
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