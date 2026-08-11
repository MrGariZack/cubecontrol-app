/**
 * Rebuild build/icon.ico (+ public/icon.png) from build/icon.png
 * Usage: node scripts/make-icon.mjs
 */
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "build/icon.png");
const tmp = join(root, "build/.icon-sizes");
mkdirSync(tmp, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256];
const paths = [];
for (const s of sizes) {
  const p = join(tmp, `${s}.png`);
  await sharp(src).resize(s, s, { fit: "cover" }).png().toFile(p);
  paths.push(p);
}

const ico = await pngToIco(paths);
writeFileSync(join(root, "build/icon.ico"), ico);
mkdirSync(join(root, "public"), { recursive: true });
copyFileSync(src, join(root, "public/icon.png"));
console.log(`Wrote build/icon.ico (${ico.length} bytes) and public/icon.png`);
