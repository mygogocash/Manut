# @nexora/brand — Manut brand assets

Canonical home for the Manut logo (Brand CI v1.0 §2-4). **SVG is the
canonical production asset**; PNGs are generated fallbacks only.

## Asset contract (drop-in)

Place the designer-supplied files here, exactly these names:

| File | Usage |
| --- | --- |
| `assets/manut-logo-black.svg` | Primary horizontal lockup, light backgrounds |
| `assets/manut-logo-white.svg` | Reversed lockup, dark backgrounds |
| `assets/manut-symbol-black.svg` | Symbol only (favicon/PWA source), light bg |
| `assets/manut-symbol-white.svg` | Symbol only, dark bg |
| `assets/manut-symbol-1024.png` | Expo app icon / splash source (or run the rasterizer) |

Proportions per CI §3: wordmark visual height ≈ 0.78 × symbol height,
gap 0.28-0.34H, optical vertical centering.

## Rasterized outputs

`scripts/build-brand-assets.mjs` (repo root) generates:

- `apps/web/public/favicon.ico`, `apps/web/public/icons/icon-{192,512}.png`,
  `icon-maskable-{192,512}.png`, `apps/web/public/icons/apple-touch-icon.png`
- `apps/app/assets/icon.png`, `apps/app/assets/adaptive-icon.png`,
  `apps/app/assets/splash.png` (referenced from `apps/app/app.json`)

Regenerate after swapping an SVG: `node scripts/build-brand-assets.mjs`.
