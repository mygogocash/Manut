import type { FC, SVGProps } from 'react';

/**
 * Manut v1.13 — themeable 404 illustration.
 *
 * Composition: a scattered grid of tiles (the workspace) with one tile
 * missing and a magnifying glass hovering over the gap. Suggests
 * "the thing you were looking for isn't here." `currentColor`-driven
 * so it inherits from text/primary in either theme.
 */
export const ErrorIllustration404: FC<SVGProps<SVGSVGElement>> = props => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label="Page not found"
      {...props}
    >
      {/* Scattered workspace tiles — the "stuff" that should be there */}
      <g opacity="0.18">
        <rect x="22" y="26" width="32" height="32" rx="6" fill="currentColor" />
        <rect x="62" y="22" width="40" height="24" rx="5" fill="currentColor" />
        <rect
          x="110"
          y="28"
          width="28"
          height="28"
          rx="5"
          fill="currentColor"
        />
        <rect
          x="146"
          y="26"
          width="32"
          height="20"
          rx="4"
          fill="currentColor"
        />
        <rect x="20" y="68" width="24" height="24" rx="5" fill="currentColor" />
        <rect x="52" y="64" width="36" height="32" rx="6" fill="currentColor" />
        {/* gap at (96,64) — where the missing tile would be */}
        <rect
          x="140"
          y="66"
          width="38"
          height="28"
          rx="5"
          fill="currentColor"
        />
        <rect
          x="24"
          y="102"
          width="42"
          height="22"
          rx="4"
          fill="currentColor"
        />
        <rect
          x="74"
          y="106"
          width="28"
          height="22"
          rx="4"
          fill="currentColor"
        />
        <rect
          x="110"
          y="100"
          width="34"
          height="30"
          rx="5"
          fill="currentColor"
        />
        <rect
          x="150"
          y="104"
          width="28"
          height="22"
          rx="4"
          fill="currentColor"
        />
      </g>

      {/* Dashed outline of the missing tile — the "void" */}
      <rect
        x="96"
        y="64"
        width="36"
        height="32"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="4 4"
        opacity="0.55"
      />

      {/* Magnifying glass — slightly off-centre over the gap.
          Heavier stroke + filled-circle handle so it reads as the focal point. */}
      <g transform="translate(108 80)">
        <circle r="34" stroke="currentColor" strokeWidth="4.5" opacity="0.95" />
        <circle r="34" fill="currentColor" opacity="0.06" />
        <line
          x1="24"
          y1="24"
          x2="52"
          y2="52"
          stroke="currentColor"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        {/* glint */}
        <path
          d="M -14 -16 Q -22 -8 -18 4"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.45"
        />
      </g>

      {/* "404" subtle echo, lower right */}
      <text
        x="160"
        y="186"
        textAnchor="end"
        fill="currentColor"
        opacity="0.35"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="11"
        fontWeight="700"
        letterSpacing="0.2em"
      >
        404
      </text>
    </svg>
  );
};
