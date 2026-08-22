import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(desktopRoot, "build", "icon.png");
const mobileRoot = join(desktopRoot, "..", "mobile");
const assets = join(mobileRoot, "assets");
const res = join(mobileRoot, "android", "app", "src", "main", "res");
const bg = "#07090C";

const mipmaps = [
  ["mipmap-mdpi", 48, 108],
  ["mipmap-hdpi", 72, 162],
  ["mipmap-xhdpi", 96, 216],
  ["mipmap-xxhdpi", 144, 324],
  ["mipmap-xxxhdpi", 192, 432],
];

mkdirSync(assets, { recursive: true });

const master = sharp(src).resize(1024, 1024, { fit: "cover" }).png();
await master.clone().toFile(join(assets, "icon.png"));
await master.clone().toFile(join(assets, "favicon.png"));
await master.clone().toFile(join(assets, "splash-icon.png"));

const padded = await sharp(src)
  .resize(720, 720, { fit: "contain", background: { r: 7, g: 9, b: 12, alpha: 0 } })
  .extend({
    top: 152,
    bottom: 152,
    left: 152,
    right: 152,
    background: { r: 7, g: 9, b: 12, alpha: 0 },
  })
  .png()
  .toBuffer();

await sharp(padded).toFile(join(assets, "android-icon-foreground.png"));
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: bg },
})
  .png()
  .toFile(join(assets, "android-icon-background.png"));
await sharp(padded).grayscale().toFile(join(assets, "android-icon-monochrome.png"));

for (const [folder, launcher, foreground] of mipmaps) {
  const dir = join(res, folder);
  mkdirSync(dir, { recursive: true });
  await sharp(src).resize(launcher, launcher).png().toFile(join(dir, "ic_launcher.png"));
  await sharp(src).resize(launcher, launcher).png().toFile(join(dir, "ic_launcher_round.png"));
  await sharp(padded).resize(foreground, foreground).png().toFile(join(dir, "ic_launcher_foreground.png"));
  await sharp({
    create: { width: foreground, height: foreground, channels: 4, background: bg },
  })
    .png()
    .toFile(join(dir, "ic_launcher_background.png"));
  await sharp(padded).resize(foreground, foreground).grayscale().png().toFile(join(dir, "ic_launcher_monochrome.png"));
}

console.log("Icono de escritorio copiado a assets y mipmaps de Android.");
