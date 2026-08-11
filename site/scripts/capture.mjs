#!/usr/bin/env node
/**
 * Capture marketing screenshots from the Vite renderer in DEV demo mode.
 * Prerequisite: `pnpm desktop` (or Vite on :5173) with the marketing demo wired.
 *
 *   node site/scripts/capture.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "assets");
const base = process.env.CUBECONTROL_CAPTURE_URL ?? "http://localhost:5173/?demo=1";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1360, height: 860 },
  deviceScaleFactor: 1,
});

page.setDefaultTimeout(60_000);
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector(".studio-sidebar__logo", { timeout: 60_000 });
await page.waitForTimeout(800);

await page.screenshot({ path: join(outDir, "hero-editor.png"), type: "png" });

await page.locator(".studio-sidebar__nav-btn", { hasText: /Library|Biblioteca/i }).click();
await page.waitForSelector(".lib-ws, [class*='library']", { timeout: 15_000 }).catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, "feature-library.png"), type: "png" });

await page.locator(".studio-sidebar__nav-btn", { hasText: /Device|Dispositivo/i }).click();
await page.waitForSelector(".dev-ws", { timeout: 15_000 });
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, "feature-device.png"), type: "png" });

await browser.close();
console.log(`Wrote screenshots to ${outDir}`);
