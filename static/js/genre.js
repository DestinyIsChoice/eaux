const audio = document.getElementById("audio");
const form = document.getElementById("song-form");
const genre = document.getElementById("genre").dataset.genre;
const source = document.getElementById("source");

function updateAudioSource() {
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
      document.getElementById("list").innerHTML = data.queue
        .map(
          (song) =>
            `${song.song_name.toLowerCase()}
                        - ${song.artist_name.toLowerCase()}
                        <br>`,
        )
        .join("");
    })
    .catch(() => {
    });
}

setInterval(updateAudioSource, 1000);

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

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  await fetch(`/${genre}`, {
   method: "POST",
   body: new FormData(form)
  });
});
