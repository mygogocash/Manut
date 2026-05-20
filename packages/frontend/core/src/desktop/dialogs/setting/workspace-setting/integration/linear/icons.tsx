import type { SVGProps } from 'react';

/**
 * Inline Linear brand mark. Single-color glyph at 24×24px keeps the
 * integration card legible in both light and dark themes. Drawn from
 * Linear's published brand guidelines monochrome variant — the
 * gradient-on-black logo is reserved for marketing surfaces.
 */
export const LinearLogoIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M3.005 9.378a.124.124 0 0 1 .035-.092L9.286 3.04a.124.124 0 0 1 .092-.035 9.029 9.029 0 0 0-6.373 6.373zM3.001 12.36c.014.396.058.79.13 1.18l7.327 7.327c.39.073.785.117 1.181.13L3.001 12.361zm.524 3.358a9.05 9.05 0 0 0 5.755 5.755L3.525 15.717zM6.07 19.408a9.052 9.052 0 0 0 14.943-6.83.124.124 0 0 0-.035-.092L9.379 3.04a.124.124 0 0 0-.092-.035A9.052 9.052 0 0 0 6.07 19.408z" />
    </svg>
  );
};
