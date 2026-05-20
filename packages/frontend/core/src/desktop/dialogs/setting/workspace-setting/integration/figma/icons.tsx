import type { SVGProps } from 'react';

/**
 * Inline Figma brand mark — the four-colour "F" reduced to a
 * monochrome silhouette. Figma's published brand guidelines permit
 * monochrome use in single-color contexts; the full four-tone glyph
 * is reserved for marketing surfaces. Rendered via `currentColor` so
 * it inherits the surrounding text color.
 */
export const FigmaLogoIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M8 24c2.208 0 4-1.792 4-4v-4H8c-2.208 0-4 1.792-4 4s1.792 4 4 4zm-4-12c0-2.208 1.792-4 4-4h4v8H8c-2.208 0-4-1.792-4-4zm0-8c0-2.208 1.792-4 4-4h4v8H8C5.792 8 4 6.208 4 4zm8-4h4c2.208 0 4 1.792 4 4s-1.792 4-4 4h-4V0zm8 12c0 2.208-1.792 4-4 4s-4-1.792-4-4 1.792-4 4-4 4 1.792 4 4z" />
    </svg>
  );
};
