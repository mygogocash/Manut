// Generates the PWA icon set from the existing brand artwork.
//
// Run: node apps/web/scripts/generate-pwa-icons.mjs
//
// Source: public/tbh-circle-logo.ico — the only brand raster in the repo, a
// single 252x256 32-bit uncompressed DIB. No new artwork is created here: the
// logo is decoded, box-filtered down, and centred on a square canvas.
//
// Written against Node built-ins (zlib only) on purpose. There is no sharp and
// no ImageMagick on the build machines, and adding an image toolchain to
// produce six static files that change only when the brand does would be a poor
// trade. Committed alongside the PNGs so they have provenance and can be
// regenerated rather than being unexplained binaries.

import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "..", "public");
const OUT = join(PUBLIC, "icons");

/** Brand background for icons that cannot be transparent. --background, #F4F2EC. */
const BRAND_BG = [244, 242, 236, 255];

/* ── ICO / DIB decode ─────────────────────────────────────────────── */

function decodeIco(buf) {
  if (buf.readUInt16LE(2) !== 1) throw new Error("not an icon file");
  const count = buf.readUInt16LE(4);
  if (count < 1) throw new Error("icon contains no images");

  // Largest entry wins; this file has exactly one.
  let best = null;
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16;
    const w = buf[o] || 256;
    const h = buf[o + 1] || 256;
    const size = buf.readUInt32LE(o + 8);
    const offset = buf.readUInt32LE(o + 12);
    if (!best || w * h > best.w * best.h) best = { w, h, size, offset };
  }

  const body = buf.subarray(best.offset, best.offset + best.size);
  if (body.readUInt32BE(0) === 0x89504e47) {
    throw new Error("entry is PNG-encoded; decode not implemented (not needed here)");
  }

  // BITMAPINFOHEADER
  const headerSize = body.readUInt32LE(0);
  const width = body.readInt32LE(4);
  // Height is doubled when an AND mask follows the colour data.
  const rawHeight = body.readInt32LE(8);
  const bpp = body.readUInt16LE(14);
  if (bpp !== 32) throw new Error(`expected 32bpp, got ${bpp}`);
  const height = rawHeight === best.h * 2 ? best.h : Math.abs(rawHeight);

  const pixels = new Uint8ClampedArray(width * height * 4);
  const rowBytes = width * 4; // 32bpp rows are already 4-byte aligned
  const start = headerSize;

  for (let y = 0; y < height; y++) {
    // DIB rows are bottom-up.
    const src = start + (height - 1 - y) * rowBytes;
    for (let x = 0; x < width; x++) {
      const s = src + x * 4;
      const d = (y * width + x) * 4;
      pixels[d] = body[s + 2]; // B G R A -> R
      pixels[d + 1] = body[s + 1];
      pixels[d + 2] = body[s];
      pixels[d + 3] = body[s + 3];
    }
  }
  return { width, height, pixels };
}

/* ── Resample + compose ───────────────────────────────────────────── */

/** Box-filter downscale. Averages in premultiplied space so edges do not halo. */
function resize(src, sw, sh, dw, dh) {
  const out = new Uint8ClampedArray(dw * dh * 4);
  const xRatio = sw / dw;
  const yRatio = sh / dh;

  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * yRatio);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * yRatio));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * xRatio);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * xRatio));

      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1 && sy < sh; sy++) {
        for (let sx = x0; sx < x1 && sx < sw; sx++) {
          const i = (sy * sw + sx) * 4;
          const alpha = src[i + 3] / 255;
          r += src[i] * alpha;
          g += src[i + 1] * alpha;
          b += src[i + 2] * alpha;
          a += src[i + 3];
          n++;
        }
      }
      const d = (y * dw + x) * 4;
      if (!n || a === 0) {
        out[d] = out[d + 1] = out[d + 2] = out[d + 3] = 0;
        continue;
      }
      const avgAlpha = a / n / 255;
      out[d] = r / n / avgAlpha;
      out[d + 1] = g / n / avgAlpha;
      out[d + 2] = b / n / avgAlpha;
      out[d + 3] = a / n;
    }
  }
  return out;
}

/**
 * Centres `src` on a `size` square.
 *
 * `inset` is the fraction of the canvas the artwork occupies — 1 for a plain
 * icon, ~0.6 for a maskable one, where the platform may crop to a circle and
 * only the central 80% is guaranteed visible.
 */
function compose(src, sw, sh, size, { inset = 1, background = null } = {}) {
  const canvas = new Uint8ClampedArray(size * size * 4);
  if (background) {
    for (let i = 0; i < size * size; i++) {
      canvas[i * 4] = background[0];
      canvas[i * 4 + 1] = background[1];
      canvas[i * 4 + 2] = background[2];
      canvas[i * 4 + 3] = background[3];
    }
  }

  const target = Math.round(size * inset);
  const scale = Math.min(target / sw, target / sh);
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const art = resize(src, sw, sh, dw, dh);

  const ox = Math.round((size - dw) / 2);
  const oy = Math.round((size - dh) / 2);

  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const s = (y * dw + x) * 4;
      const d = ((y + oy) * size + (x + ox)) * 4;
      const a = art[s + 3] / 255;
      if (a === 0) continue;
      // Source-over onto whatever is already there.
      const ba = canvas[d + 3] / 255;
      const outA = a + ba * (1 - a);
      canvas[d] = (art[s] * a + canvas[d] * ba * (1 - a)) / outA;
      canvas[d + 1] = (art[s + 1] * a + canvas[d + 1] * ba * (1 - a)) / outA;
      canvas[d + 2] = (art[s + 2] * a + canvas[d + 2] * ba * (1 - a)) / outA;
      canvas[d + 3] = outA * 255;
    }
  }
  return canvas;
}

/* ── PNG encode ───────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 10-12: deflate, adaptive filtering, no interlace — all zero.

  // Filter type 0 per scanline. Adaptive filtering would compress better, but
  // these files are tiny and correctness beats a few hundred bytes.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── Run ──────────────────────────────────────────────────────────── */

const source = decodeIco(readFileSync(join(PUBLIC, "tbh-circle-logo.ico")));
console.log(`source: ${source.width}x${source.height} from tbh-circle-logo.ico`);

mkdirSync(OUT, { recursive: true });

const TARGETS = [
  // Plain icons. Opaque brand ground, NOT transparent: the mark is near-black,
  // so on Android's dark launcher or the Windows dark taskbar a transparent
  // background renders the icon as an invisible smudge. Chrome and iOS both
  // composite icons anyway, so transparency buys nothing here.
  { file: "icon-192.png", size: 192, inset: 0.78, background: BRAND_BG },
  { file: "icon-512.png", size: 512, inset: 0.78, background: BRAND_BG },
  // Maskable: opaque brand ground, artwork inside the 80% safe zone so a
  // platform cropping to a circle or squircle cannot clip the mark.
  { file: "icon-maskable-192.png", size: 192, inset: 0.62, background: BRAND_BG },
  { file: "icon-maskable-512.png", size: 512, inset: 0.62, background: BRAND_BG },
  // iOS composites a touch icon onto black, so it must be opaque, and it
  // applies its own corner radius — no inset needed.
  { file: "apple-touch-icon.png", size: 180, inset: 0.86, background: BRAND_BG },
];

for (const t of TARGETS) {
  const pixels = compose(source.pixels, source.width, source.height, t.size, t);
  const png = encodePng(pixels, t.size);
  writeFileSync(join(OUT, t.file), png);
  console.log(`  wrote icons/${t.file}  ${t.size}x${t.size}  ${png.length} bytes`);
}
