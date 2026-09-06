#!/usr/bin/env node
/**
 * Manut Brand CI — rasterize the canonical SVG assets (packages/brand/assets)
 * into the bitmap fallbacks the platforms require (CI §4: SVG is canonical,
 * PNG is fallback only).
 *
 * Inputs (see packages/brand/README.md):
 *   packages/brand/assets/manut-symbol-black.svg   (light backgrounds)
 *   packages/brand/assets/manut-symbol-white.svg   (dark/maskable backgrounds)
 *
 * Outputs:
 *   apps/web/public/favicon.ico
 *   apps/web/public/icons/apple-touch-icon.png          (180x180)
 *   apps/web/public/icons/icon-192.png / icon-512.png   (purpose: any)
 *   apps/web/public/icons/icon-maskable-192.png / -512.png
 *   apps/app/assets/icon.png (1024), adaptive-icon.png (1024), splash.png
 *
 * Usage: node scripts/build-brand-assets.mjs
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = resolve(root, "packages/brand/assets");

const black = resolve(assets, "manut-symbol-black.svg");
const white = resolve(assets, "manut-symbol-white.svg");

for (const f of [black, white]) {
  if (!existsSync(f)) {
    console.error(`Missing input: ${f}`);
    console.error("Drop the designer SVGs into packages/brand/assets/ — see packages/brand/README.md.");
    process.exit(1);
  }
}

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  // sharp is not a root dependency; it lives in a workspace's graph. Resolve
  // it from the pnpm store directly so the script stays dependency-free.
  try {
    const { readdirSync } = await import("node:fs");
    const storeDir = resolve(root, "node_modules/.pnpm");
    const dir = readdirSync(storeDir).find((d) => d.startsWith("sharp@"));
    if (!dir) throw new Error("no sharp in store");
    sharp = (await import(resolve(storeDir, dir, "node_modules/sharp/dist/index.mjs"))).default;
  } catch {
    console.error("sharp is not available in this workspace. Provide designer PNG exports instead");
    console.error("(packages/brand/assets/manut-symbol-1024.png) or install sharp and re-run.");
    process.exit(1);
  }
}

const webPublic = resolve(root, "apps/web/public");
const webIcons = resolve(webPublic, "icons");
const appAssets = resolve(root, "apps/app/assets");
await mkdir(webIcons, { recursive: true });
await mkdir(appAssets, { recursive: true });

async function png(source, size, out, { background } = {}) {
  let img = sharp(source, { density: 300 }).resize(size, size);
  if (background) img = img.flatten({ background });
  await img.png().toFile(out);
  console.log("wrote", out.replace(root + "/", ""));
}

// Web: "any" icons from the black symbol (transparent background preserved).
await png(black, 192, resolve(webIcons, "icon-192.png"));
await png(black, 512, resolve(webIcons, "icon-512.png"));
await png(black, 180, resolve(webIcons, "apple-touch-icon.png"));

// Maskable: the safe zone is the inner ~80% — pad the symbol on an Ink tile.
await png(black, 192, resolve(webIcons, "icon-maskable-192.png"), { background: "#0B0B0A" });
await png(black, 512, resolve(webIcons, "icon-maskable-512.png"), { background: "#0B0B0A" });

// Favicon. png-to-ico (optional dev dep) produces a real .ico; without it we
// ship a 32px PNG payload at the same URL, which every modern browser accepts.
const favicon32 = resolve(webPublic, "favicon-32.png");
await png(black, 32, favicon32);
const icoOut = resolve(webPublic, "favicon.ico");
try {
  const pngToIco = (await import("png-to-ico")).default;
  await writeFile(icoOut, await pngToIco([favicon32]));
  console.log("wrote favicon.ico (real ICO)");
} catch {
  await copyFile(favicon32, icoOut);
  console.log("wrote favicon.ico (PNG payload — png-to-ico not installed)");
}
await rm(favicon32, { force: true });

// Expo app icon + adaptive foreground from the black symbol; splash = symbol
// centered on Paper.
await png(black, 1024, resolve(appAssets, "icon.png"));
await png(black, 1024, resolve(appAssets, "adaptive-icon.png"));
await sharp(black, { density: 300 })
  .resize(512, 512)
  .flatten({ background: "#F7F7F3" })
  .extend({ top: 256, bottom: 256, left: 256, right: 256, background: "#F7F7F3" })
  .png()
  .toFile(resolve(appAssets, "splash.png"));
console.log("wrote apps/app/assets/splash.png");

// White symbol kept beside the outputs for dark-surface usages.
await copyFile(white, resolve(webIcons, "manut-symbol-white.svg"));
console.log("done.");
