// Tiny SVG wireframe previews shown in the layout-picker hover tooltip.
// Each preview is a 200x120 viewBox rendered at 200x120 px in the tooltip.
// Strokes / fills use Affine theme tokens via currentColor + opacity so they
// look correct in both light and dark themes.
import { html, type TemplateResult } from 'lit';

const FRAME_W = 200;
const FRAME_H = 120;

const wrap = (body: TemplateResult): TemplateResult => html`
  <svg
    width=${FRAME_W}
    height=${FRAME_H}
    viewBox="0 0 ${FRAME_W} ${FRAME_H}"
    xmlns="http://www.w3.org/2000/svg"
    style="display:block;color:var(--affine-white);"
  >
    <rect
      x="0"
      y="0"
      width=${FRAME_W}
      height=${FRAME_H}
      fill="currentColor"
      fill-opacity="0.06"
      rx="4"
    />
    ${body}
  </svg>
`;

// Helpers: thin line and filled cell using currentColor.
const line = (x1: number, y1: number, x2: number, y2: number, op = 0.4) => html`
  <line
    x1=${x1}
    y1=${y1}
    x2=${x2}
    y2=${y2}
    stroke="currentColor"
    stroke-opacity=${op}
    stroke-width="1"
  />
`;
const cell = (
  x: number,
  y: number,
  w: number,
  h: number,
  op = 0.5,
  rx = 2
) => html`
  <rect
    x=${x}
    y=${y}
    width=${w}
    height=${h}
    rx=${rx}
    fill="currentColor"
    fill-opacity=${op}
  />
`;

// 5-column / 4-row grid.
export const tablePreview = () =>
  wrap(html`
    ${cell(8, 8, 184, 14, 0.25)} ${cell(12, 12, 28, 6, 0.55)}
    ${cell(48, 12, 28, 6, 0.55)} ${cell(84, 12, 28, 6, 0.55)}
    ${cell(120, 12, 28, 6, 0.55)} ${cell(156, 12, 28, 6, 0.55)}
    ${[0, 1, 2, 3].map(
      i => html`
        ${line(8, 30 + i * 22, 192, 30 + i * 22, 0.18)}
        ${cell(12, 36 + i * 22, 22, 6, 0.4)}
        ${cell(48, 36 + i * 22, 22, 6, 0.4)}
        ${cell(84, 36 + i * 22, 22, 6, 0.4)}
        ${cell(120, 36 + i * 22, 22, 6, 0.4)}
        ${cell(156, 36 + i * 22, 22, 6, 0.4)}
      `
    )}
    ${line(40, 30, 40, 118, 0.18)} ${line(76, 30, 76, 118, 0.18)}
    ${line(112, 30, 112, 118, 0.18)} ${line(148, 30, 148, 118, 0.18)}
  `);

// Three columns of stacked cards.
export const kanbanPreview = () =>
  wrap(html`
    ${[0, 1, 2].map(col => {
      const x = 12 + col * 62;
      return html`
        ${cell(x, 8, 56, 8, 0.55)} ${cell(x, 22, 56, 22, 0.3)}
        ${cell(x + 4, 26, 30, 4, 0.6)} ${cell(x + 4, 34, 38, 4, 0.4)}
        ${cell(x, 50, 56, 22, 0.3)} ${cell(x + 4, 54, 26, 4, 0.6)}
        ${cell(x + 4, 62, 42, 4, 0.4)} ${cell(x, 78, 56, 22, 0.3)}
        ${cell(x + 4, 82, 34, 4, 0.6)} ${cell(x + 4, 90, 32, 4, 0.4)}
      `;
    })}
  `);

// Month grid 7x4.
export const calendarPreview = () =>
  wrap(html`
    ${cell(8, 8, 184, 12, 0.3)}
    ${[0, 1, 2, 3, 4, 5, 6].map(c => cell(14 + c * 26, 11, 14, 6, 0.55))}
    ${[0, 1, 2, 3].map(r =>
      [0, 1, 2, 3, 4, 5, 6].map(
        c => html`
          ${line(8 + c * 26, 24 + r * 24, 8 + c * 26, 24 + (r + 1) * 24, 0.18)}
          ${line(8, 24 + r * 24, 192, 24 + r * 24, 0.18)}
          ${cell(12 + c * 26, 28 + r * 24, 6, 4, 0.45)}
        `
      )
    )}
    ${cell(34, 56, 48, 6, 0.55)} ${cell(110, 80, 56, 6, 0.55)}
  `);

// Horizontal bars on a timeline axis.
export const timelinePreview = () =>
  wrap(html`
    ${cell(8, 8, 184, 10, 0.25)}
    ${[16, 50, 84, 118].map(x => line(x, 8, x, 18, 0.4))}
    ${cell(20, 28, 70, 10, 0.6)} ${cell(60, 46, 90, 10, 0.55)}
    ${cell(40, 64, 60, 10, 0.5)} ${cell(100, 82, 80, 10, 0.6)}
    ${cell(30, 100, 50, 10, 0.45)} ${line(8, 24, 192, 24, 0.2)}
    ${line(8, 60, 192, 60, 0.18)} ${line(8, 96, 192, 96, 0.18)}
  `);

// Stacked rows with leading icons.
export const listPreview = () =>
  wrap(html`
    ${[0, 1, 2, 3, 4, 5].map(
      i => html`
        ${cell(12, 12 + i * 16, 8, 8, 0.55, 1)}
        ${cell(28, 14 + i * 16, 110, 4, 0.55)}
        ${cell(28, 20 + i * 16, 80, 3, 0.3)}
        ${line(8, 28 + i * 16, 192, 28 + i * 16, 0.15)}
      `
    )}
  `);

// Vertical feed of mixed content cards.
export const feedPreview = () =>
  wrap(html`
    ${cell(12, 10, 176, 30, 0.28)} ${cell(18, 14, 30, 22, 0.55, 1)}
    ${cell(54, 16, 100, 4, 0.55)} ${cell(54, 24, 130, 3, 0.35)}
    ${cell(54, 30, 110, 3, 0.35)} ${cell(12, 46, 176, 30, 0.28)}
    ${cell(18, 50, 30, 22, 0.55, 1)} ${cell(54, 52, 90, 4, 0.55)}
    ${cell(54, 60, 130, 3, 0.35)} ${cell(54, 66, 100, 3, 0.35)}
    ${cell(12, 82, 176, 30, 0.28)} ${cell(18, 86, 30, 22, 0.55, 1)}
    ${cell(54, 88, 110, 4, 0.55)} ${cell(54, 96, 120, 3, 0.35)}
    ${cell(54, 102, 90, 3, 0.35)}
  `);

// 3x2 grid of image tiles.
export const galleryPreview = () =>
  wrap(html`
    ${[0, 1, 2].map(c =>
      [0, 1].map(r => {
        const x = 12 + c * 62;
        const y = 10 + r * 52;
        return html`
          ${cell(x, y, 56, 36, 0.35)} ${cell(x + 8, y + 8, 16, 16, 0.55, 8)}
          ${cell(x + 4, y + 40, 40, 4, 0.5)}
        `;
      })
    )}
  `);

// Form: label + input rows + submit button.
export const formPreview = () =>
  wrap(html`
    ${cell(20, 10, 100, 6, 0.55)}
    ${[0, 1, 2].map(
      i => html`
        ${cell(20, 26 + i * 22, 40, 4, 0.5)}
        ${cell(20, 34 + i * 22, 160, 10, 0.25, 3)}
      `
    )}
    ${cell(20, 96, 60, 14, 0.6, 3)}
  `);

// Bar chart.
export const chartPreview = () =>
  wrap(html`
    ${cell(8, 8, 184, 12, 0.25)} ${cell(14, 11, 80, 6, 0.55)}
    ${line(20, 100, 188, 100, 0.4)} ${line(20, 100, 20, 28, 0.4)}
    ${cell(28, 70, 16, 30, 0.6)} ${cell(52, 50, 16, 50, 0.5)}
    ${cell(76, 38, 16, 62, 0.65)} ${cell(100, 60, 16, 40, 0.5)}
    ${cell(124, 44, 16, 56, 0.6)} ${cell(148, 78, 16, 22, 0.5)}
    ${cell(172, 56, 16, 44, 0.55)}
  `);

// Dashboard: KPI tiles + a chart.
export const dashboardPreview = () =>
  wrap(html`
    ${[0, 1, 2].map(c => {
      const x = 12 + c * 62;
      return html`
        ${cell(x, 10, 56, 28, 0.3)} ${cell(x + 6, 14, 24, 4, 0.55)}
        ${cell(x + 6, 24, 30, 8, 0.7)}
      `;
    })}
    ${cell(12, 46, 116, 64, 0.28)} ${cell(18, 52, 50, 4, 0.55)}
    ${[0, 1, 2, 3, 4].map(i =>
      cell(22 + i * 20, 92 - i * 6, 14, 14 + i * 6, 0.55)
    )}
    ${cell(134, 46, 54, 64, 0.28)} ${cell(140, 52, 30, 4, 0.55)}
    ${cell(146, 64, 30, 30, 0.55, 16)} ${cell(152, 70, 18, 18, 0.18, 12)}
  `);

// Map: pin scatter on a stylised landmass.
export const mapPreview = () =>
  wrap(html`
    <path
      d="M 20 80 Q 50 40 80 60 T 150 50 Q 180 60 188 90 L 188 110 L 16 110 Z"
      fill="currentColor"
      fill-opacity="0.18"
    />
    ${line(8, 30, 192, 30, 0.12)} ${line(8, 60, 192, 60, 0.12)}
    ${line(8, 90, 192, 90, 0.12)} ${line(50, 8, 50, 118, 0.12)}
    ${line(100, 8, 100, 118, 0.12)} ${line(150, 8, 150, 118, 0.12)}
    ${[
      [40, 70],
      [70, 50],
      [110, 70],
      [140, 60],
      [160, 80],
    ].map(
      ([cx, cy]) => html`
        <circle
          cx=${cx}
          cy=${cy}
          r="4"
          fill="currentColor"
          fill-opacity="0.7"
        />
        <circle
          cx=${cx}
          cy=${cy + 5}
          r="2"
          fill="currentColor"
          fill-opacity="0.4"
        />
      `
    )}
  `);
