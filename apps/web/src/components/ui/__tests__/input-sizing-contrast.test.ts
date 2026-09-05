import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Phase 7F — the two P2s that were fixed.
//
// Neither can be checked by rendering: jsdom computes no layout and applies no
// stylesheet. Both are properties of source that produce a measured effect in a
// browser, so they are asserted at source and the browser numbers live in
// PHASE_7F.

const read = (p: string) =>
  readFileSync(resolve(__dirname, p), "utf8");

/* ── P2-A: text fields must stay 16px on touch ─────────────────────── */

describe("text fields do not shrink on a touch device", () => {
  // iOS Safari zooms the viewport when a focused input is under 16px and never
  // zooms back. The rule used to be `md:text-sm` — "768px or wider is a
  // desktop" — which an iPad Mini (768px, touch) disproves. Phase 7E measured
  // 14px there. Keying on the pointer fixes every touch device at every width.
  for (const file of ["../input.tsx", "../textarea.tsx"]) {
    const src = read(file);

    it(`${file.replace("../", "")} keys the small size on a fine pointer`, () => {
      expect(src).toContain("md:pointer-fine:text-sm");
    });

    it(`${file.replace("../", "")} no longer shrinks on width alone`, () => {
      // The exact defect: a width-only rule. Compounded `md:pointer-fine:` is
      // fine; a bare `md:text-sm` is not.
      const bareWidthRule = /(^|\s)md:text-sm(\s|$)/m;
      expect(bareWidthRule.test(src)).toBe(false);
    });

    it(`${file.replace("../", "")} still starts from 16px`, () => {
      expect(src).toMatch(/(^|\s)text-base(\s|$)/m);
    });
  }
});

/* ── P2-B: the muted-foreground token must be readable ─────────────── */

const css = read("../../../app/globals.css");

/** `--muted-foreground: 36 9% 41%;` -> [36, 9, 41] */
function hslToken(block: string, name: string): [number, number, number] {
  const m = new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`).exec(
    block,
  );
  if (!m) throw new Error(`${name} not found`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) =>
    L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const ch = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(a: [number, number, number], b: [number, number, number]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The `:root {}` block is light; the `.dark {}` block is dark. */
function block(selector: string): string {
  const i = css.indexOf(selector);
  if (i < 0) throw new Error(`${selector} not found`);
  return css.slice(i, css.indexOf("}", i));
}

const AA_NORMAL_TEXT = 4.5;

describe("muted text is readable on every surface it is used on", () => {
  // axe flagged this at 2.38:1 on the sign-in labels in Phase 7E. It is a
  // global token, so the failure was every muted label, hint, timestamp and
  // secondary value in the application — not one page.
  const surfaces = ["background", "surface", "surface-secondary", "muted"];

  for (const [themeName, selector] of [
    ["light", ":root"],
    ["dark", ".dark"],
  ] as const) {
    const b = block(selector);
    const fg = hslToRgb(hslToken(b, "muted-foreground"));

    for (const surface of surfaces) {
      it(`${themeName}: muted-foreground on ${surface} meets AA`, () => {
        const bg = hslToRgb(hslToken(b, surface));
        const ratio = contrast(fg, bg);
        expect(
          ratio,
          `${themeName} muted-foreground on --${surface} is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });
    }

    it(`${themeName}: muted text stays visibly lighter than primary text`, () => {
      // A fix that darkened muted text until it matched --foreground would pass
      // contrast and destroy the hierarchy the token exists for.
      const primary = hslToRgb(hslToken(b, "foreground"));
      expect(contrast(fg, primary)).toBeGreaterThan(1.5);
    });
  }
});
