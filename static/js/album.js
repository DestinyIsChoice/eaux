import convert from "color-convert";

const audio = document.getElementById("audio");
const album = document.getElementById("album").dataset.genre;
const genre = document.getElementById("genre").dataset.genre;

function updateContent() {
  // const newUrl = data.queue.length !== 0
  //   ? `${data.queue[0].url}#t=${data.queue[0].timestamp}`
  //   : "";
  // const oldUrl = source.src;
  // source.src = newUrl;
  // if (
  //   newUrl.slice(0, newUrl.indexOf("#")) !==
  //   oldUrl.slice(0, oldUrl.indexOf("#"))
  // ) {
  //   audio.load();
  // }
  // if (!audio.paused) {
  //   audio.play().catch(() => {
  //   });
  // }
  fetch(`albums`)
    .then((response) => response.json())
    .then((data) => {
      document.documentElement.style.setProperty("--primary-color", `#${convert.hsv.hex(convert.rgb.hsv(data.albums[album].colors[1])[0], 31.3, 90.2)}`);
      document.documentElement.style.setProperty("--secondary-color", `#${convert.hsv.hex(convert.rgb.hsv(data.albums[album].colors[2])[0], 32.7, 20.4)}`);
      const [backgroundR, backgroundG, backgroundB] = convert.hsv.rgb(convert.rgb.hsv(
        data.albums[album].colors[0])[0], 32.7, 20.4);
      document.documentElement.style.setProperty("--background-0-color", `#${convert.rgb.hex(backgroundR, backgroundG, backgroundB)}`);
      document.documentElement.style.setProperty("--background-1-color", `#${convert.rgb.hex(backgroundR * 1.171, backgroundG * 1.171, backgroundB * 1.171)}`);
      document.documentElement.style.setProperty("--background-2-color", `#${convert.rgb.hex(backgroundR * 1.371, backgroundG * 1.371, backgroundB * 1.371)}`);
      document.documentElement.style.setProperty("--background-3-color", `#${convert.rgb.hex(backgroundR * 1.857, backgroundG * 1.857, backgroundB * 1.857)}`);
      document.documentElement.style.setProperty("--background-4-color", `#${convert.rgb.hex(backgroundR * 2.086, backgroundG * 2.086, backgroundB * 2.086)}`);
      document.documentElement.style.setProperty("--background-5-color", `#${convert.rgb.hex(backgroundR * 2.314, backgroundG * 2.314, backgroundB * 2.314)}`);
    });
  // const newHTML = data.queue
  //   .map(
  //     (song) =>
  //       `${song.song_name.toLowerCase()}
  //                   - ${song.artist_name.toLowerCase()}
  //                   <br>`,
  //   )
  //   .join("");
  // if (newHTML !== list.innerHTML) {
  //   list.style.height = `${list.offsetHeight}px`;
  //   const clone = list.cloneNode(false);
  //   clone.style.visibility = "hidden";
  //   clone.style.position = "absolute";
  //   clone.style.height = "auto";
  //   clone.innerHTML = newHTML;
  //   list.parentNode.appendChild(clone);
  //   const targetHeight = clone.scrollHeight;
  //   clone.remove();
  //   list.innerHTML = newHTML;
  //   void list.offsetHeight;
  //   list.style.height = `${targetHeight}px`;
  // }
}

setInterval(updateContent, 1000);
