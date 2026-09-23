const audio = document.getElementById("audio");
const source = document.getElementById("source");
const genre = document.getElementById("genre").dataset.genre;

function updateAudioSource() {
  fetch(`queue/${genre}`)
    .then((response) => response.json())
    .then((data) => {
      const isPlaying = !audio.paused;
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
      if (isPlaying) {
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
