import type { FC, SVGProps } from 'react';

/**
 * Manut v1.13 — themeable 500 illustration.
 *
 * Composition: a constellation of nodes (the workspace's graph) with
 * one node fractured and its connecting edges broken at the seam.
 * Visual echo of the Knowledge Graph activation pulses (§6e) so the
 * error reads as "something on the graph snapped" rather than an
 * anonymous server-down icon. `currentColor`-driven.
 */
export const ErrorIllustration500: FC<SVGProps<SVGSVGElement>> = props => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label="Something went wrong"
      {...props}
    >
      {/* Intact edges (dashed = unreached, solid = working). */}
      <g
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.4"
      >
        <path d="M 40 60 Q 70 50 96 84" />
        <path d="M 160 56 Q 130 60 110 86" />
        <path d="M 36 140 Q 70 132 96 110" />
        <path d="M 164 144 Q 132 134 110 112" />
      </g>

      {/* Broken edges — the lightning-bolt break in the middle. */}
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      >
        <path d="M 76 96 L 92 92" />
        <path d="M 116 108 L 132 104" />
        {/* lightning crack between the two halves */}
        <path d="M 104 76 L 96 96 L 110 100 L 102 124" />
      </g>

      {/* Outer satellite nodes */}
      <g fill="currentColor" opacity="0.55">
        <circle cx="40" cy="60" r="6" />
        <circle cx="160" cy="56" r="6" />
        <circle cx="36" cy="140" r="6" />
        <circle cx="164" cy="144" r="6" />
      </g>
      {/* fainter background dots — depth */}
      <g fill="currentColor" opacity="0.25">
        <circle cx="20" cy="100" r="3" />
        <circle cx="180" cy="100" r="3" />
        <circle cx="60" cy="20" r="3" />
        <circle cx="140" cy="20" r="3" />
        <circle cx="100" cy="180" r="3.5" />
      </g>

      {/* Central fractured panel — two halves, slightly displaced. */}
      <g>
        {/* left half */}
        <path
          d="M 60 80 L 96 76 L 102 124 L 64 122 Z"
          fill="currentColor"
          opacity="0.1"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        {/* right half — shifted down 4 and right 4 to show the break */}
        <path
          d="M 110 78 L 144 82 L 140 126 L 106 128 Z"
          fill="currentColor"
          opacity="0.1"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </g>

      {/* Pulse ring around the break — "this is the broken node". */}
      <circle
        cx="100"
        cy="100"
        r="48"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="3 6"
        opacity="0.45"
      />

      {/* "500" subtle echo, lower right */}
      <text
        x="180"
        y="190"
        textAnchor="end"
        fill="currentColor"
        opacity="0.35"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="11"
        fontWeight="700"
        letterSpacing="0.2em"
      >
        500
      </text>
    </svg>
  );
};
