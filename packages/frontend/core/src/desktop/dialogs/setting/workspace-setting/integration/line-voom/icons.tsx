import type { SVGProps } from 'react';

/**
 * Inline LINE brand mark — the rounded-square speech-bubble glyph.
 * Path data simplified and adapted from Simple Icons
 * (https://simpleicons.org, license CC0-1.0). VOOM is LINE's
 * vertical-video product; LINE's brand guidelines reuse the same
 * speech-bubble for VOOM channels. The official mark is white on
 * the brand green (#06C755); for the analytics Connections panel
 * the colored circular plate supplies the green and this glyph
 * paints white on top.
 */
export const LineVoomLogoIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.282.629-.63.629h-2.386c-.345 0-.627-.285-.627-.63V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016a.63.63 0 0 1-.631.629.627.627 0 0 1-.51-.255l-2.443-3.317v2.942a.629.629 0 0 1-1.257 0V8.108a.626.626 0 0 1 .628-.626c.196 0 .375.099.483.255l2.466 3.33V8.108a.63.63 0 0 1 1.26 0v4.771zm-5.741 0a.629.629 0 0 1-.629.629.63.63 0 0 1-.63-.629V8.108a.631.631 0 0 1 1.26 0v4.771zm-2.466.629H4.917a.625.625 0 0 1-.626-.629V8.108a.627.627 0 1 1 1.254 0v4.141h1.758c.346 0 .627.282.627.63 0 .345-.282.629-.627.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
};
