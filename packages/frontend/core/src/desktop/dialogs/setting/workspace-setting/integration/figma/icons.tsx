import type { SVGProps } from 'react';

/**
 * Inline Figma brand mark — the five-tile "F". Path data adapted
 * from Simple Icons (https://simpleicons.org, license CC0-1.0).
 * Figma's published brand guidelines reserve the five-colour
 * variant for marketing surfaces; in-product chrome may use a
 * monochrome silhouette. We render in `currentColor` so the same
 * component works for both:
 *
 *   - the integration setting-panel header (monochrome, inherits
 *     the surrounding text colour), and
 *   - the analytics Connections panel (white on a brand-tinted
 *     plate so the platform identity reads even without colour).
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
      <path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.015-4.49-4.491S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.491 4.49-4.491h4.588v8.981zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.02s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.491 4.49-4.491h4.588v4.441c0 2.503-2.047 4.54-4.563 4.54zm-.024-7.51c-1.665 0-3.019 1.355-3.019 3.02 0 1.674 1.365 3.039 3.044 3.039 1.705 0 3.093-1.376 3.093-3.069V16.49H8.148zm7.704 0H15.8c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.491 4.49-4.491h.052c2.476 0 4.49 2.015 4.49 4.491s-2.014 4.49-4.49 4.49zm-.052-7.509c-1.665 0-3.019 1.355-3.019 3.02s1.355 3.019 3.019 3.019h.052c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.02-3.019-3.02h-.052z" />
    </svg>
  );
};
