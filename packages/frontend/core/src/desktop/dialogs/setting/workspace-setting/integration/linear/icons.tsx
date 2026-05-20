import type { SVGProps } from 'react';

/**
 * Inline Linear brand mark — the diagonal lines bursting out of a
 * rounded square. Path data adapted from Simple Icons
 * (https://simpleicons.org, license CC0-1.0). Linear's published
 * brand uses the gradient-on-black variant for marketing; the
 * monochrome silhouette is approved for in-product chrome. We
 * render in `currentColor` so the same component works for both:
 *
 *   - the integration setting-panel header (monochrome), and
 *   - the analytics Connections panel (white on a brand-violet
 *     plate so the platform identity reads even at 32px).
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
