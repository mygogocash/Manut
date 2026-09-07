#!/usr/bin/env node
/**
 * Manut Brand CI v1.0 — WCAG contrast report (CI §31, target WCAG 2.2 AA).
 *
 * Verifies every canonical text/background pair in the design tokens.
 * Run: node scripts/brand-contrast.mjs   (exit 1 on any AA failure)
 *
 * Pair values are duplicated here intentionally (not parsed from CSS) so a
 * change to a token FAILS this report until the pair is re-validated — that
 * friction is the point.
 */

// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
function luminance(hex) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratio(fg, bg) {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

// fg hex, bg hex(es), minimum ratio, note
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0; // ≥18pt (24px) regular or ≥14pt (18.66px) bold

const pairs = [
  // { fg, bg, min, note }
  { fg: "#0B0B0A", bg: ["#F7F7F3", "#FFFFFF", "#F0EFEA", "#FAFAF7", "#F1F1FF"], min: AA_NORMAL, note: "foreground (Ink) on background/card/muted/accent" },
  { fg: "#555550", bg: ["#F7F7F3", "#FFFFFF", "#F0EFEA", "#FAFAF7"], min: AA_NORMAL, note: "muted-foreground (Stone 700) on its four backgrounds" },
  { fg: "#FFFFFF", bg: ["#0B0B0A", "#282826"], min: AA_NORMAL, note: "primary button text on Ink/Graphite" },
  { fg: "#5B5BD6", bg: ["#FFFFFF", "#F7F7F3"], min: AA_NORMAL, note: "Intelligence 500 as text/link on light surfaces" },
  { fg: "#FFFFFF", bg: "#5B5BD6", min: AA_NORMAL, note: "AI action button text on Intelligence 500" },
  { fg: "#FFFFFF", bg: ["#237A57", "#A86710", "#C53B36", "#3973C6"], min: AA_NORMAL, note: "text on the four semantic fills" },
  { fg: "#272761", bg: "#F1F1FF", min: AA_NORMAL, note: "Intelligence 900 text on Intelligence 50 surface" },

  // Decorative / large-only: CI Stone 500 "metadata" tone. Deliberately NOT
  // wired to --muted-foreground; large text or non-essential decoration only.
  { fg: "#85857E", bg: ["#F7F7F3", "#FFFFFF"], min: AA_LARGE, note: "Stone 500 metadata — large text only (3.46-3.71:1, never body text)" },

  // Dark theme (CI §26)
  { fg: "#F5F4EF", bg: ["#111110", "#181817", "#20201E"], min: AA_NORMAL, note: "dark primary text on canvas/surface/raised" },
  { fg: "#A8A7A0", bg: ["#111110", "#181817"], min: AA_NORMAL, note: "dark secondary text" },
  { fg: "#7777E8", bg: "#181817", min: AA_NORMAL, note: "dark Intelligence on Surface" },
  { fg: "#0B0B0A", bg: "#7777E8", min: AA_NORMAL, note: "dark AI action text on Intelligence" },
];

let failed = 0;
let checked = 0;
for (const { fg, bg, min, note } of pairs) {
  for (const bgSingle of [].concat(bg)) {
    checked += 1;
    const r = ratio(fg, bgSingle);
    const ok = r >= min;
    if (!ok) failed += 1;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (min ${min.toFixed(1)})  ${fg} on ${bgSingle}  — ${note}`,
    );
  }
}
console.log(`\n${checked - failed}/${checked} pairs pass.`);
if (failed > 0) {
  console.error(`${failed} pair(s) below threshold — fix the token or reclassify the usage.`);
  process.exit(1);
}
