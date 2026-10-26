import convert from "color-convert";

export function generateCanvas(image) {
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
  return canvas;
}

export function setColorScheme(backgroundHsv, primaryHsv, secondaryHsv) {
  const [backgroundR, backgroundG, backgroundB] = convert.hsv.rgb(
    backgroundHsv[0], backgroundHsv[1], 21.18);
  document.documentElement.style.setProperty("--primary-color",
    `#${convert.hsv.hex(primaryHsv[0], Math.min(primaryHsv[1], 40), 93.33)}`);
  document.documentElement.style.setProperty("--secondary-color",
    `#${convert.hsv.hex(secondaryHsv[0], secondaryHsv[1], 21.18)}`);
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
}
