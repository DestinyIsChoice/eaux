const audio = document.getElementById("audio");
const form = document.getElementById("song-form");
const genre = document.getElementById("genre").dataset.genre;
const list = document.getElementById("list");
const source = document.getElementById("source");

function updateContent() {
  fetch(`queue/${genre}`)
    .then((response) => response.json())
    .then((data) => {
      const newUrl = data.queue
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
        audio.play().catch(() => {
        });
      }
      document.documentElement.style.setProperty("--primary-color", data.queue[0].colors[1]);
      document.documentElement.style.setProperty("--secondary-color", data.queue[0].colors[0]);
      document.documentElement.style.setProperty("--tertiary-color", data.queue[0].colors[2]);
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

setInterval(updateContent, 1000);

document.addEventListener("DOMContentLoaded", () => {
  const dropdownTrigger = document.querySelector(".form-dropdown-trigger");
  const dropdownForm = document.querySelector("form");
  if (dropdownTrigger && dropdownForm) {
    dropdownTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      dropdownForm.classList.toggle("show");
    });
    document.addEventListener("click", (event) => {
      if (!dropdownForm.contains(event.target) && event.target !== dropdownTrigger) {
        dropdownForm.classList.remove("show");
      }
    });
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await fetch(`/${genre}`, {
    method: "POST",
    body: new FormData(form)
  });
});
