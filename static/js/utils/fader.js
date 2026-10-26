export async function fadeOut(audio) {
  while (audio.volume > 0.25) {
    audio.volume -= 0.25;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  audio.volume = 0;
}
