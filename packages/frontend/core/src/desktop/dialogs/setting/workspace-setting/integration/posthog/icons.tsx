import type { SVGProps } from 'react';

/**
 * Inline PostHog brand mark — the three stacked hedgehog spines.
 * Path data adapted from Simple Icons (https://simpleicons.org,
 * license CC0-1.0). PostHog's brand orange (#F54E00) is supplied
 * by the analytics Connections panel's coloured plate; this glyph
 * paints `currentColor` so it's white on the orange plate there,
 * and inherits text colour in the integration setting-panel
 * header.
 */
export const PostHogLogoIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M9.854 14.5a1 1 0 0 0-.707 1.707l4.5 4.5a1 1 0 0 0 1.707-.707v-4.5a1 1 0 0 0-1-1zm-7 0a1 1 0 0 0-.707 1.707l4.5 4.5a1 1 0 0 0 1.707-.707V8.621a1 1 0 0 0-.293-.707L2.561 1.914a1 1 0 0 0-1.707.707v4.5a1 1 0 0 0 .293.707L7.354 14h-4.5zm9.793-7.379L7.561 1.914a1 1 0 0 0-1.707.707v4.5a1 1 0 0 0 .293.707L11.561 13.5a1 1 0 0 0 1.707-.707v-4.5a1 1 0 0 0-.293-.707zM21.561 14.5h-4.5a1 1 0 0 0-.707 1.707l4.5 4.5a1 1 0 0 0 1.707-.707v-4.5a1 1 0 0 0-1-1zm-.293-7.379L16.561 2.414a1 1 0 0 0-1.707.707v4.5a1 1 0 0 0 .293.707l4.5 4.5a1 1 0 0 0 1.707-.707v-4.5a1 1 0 0 0-.293-.707zM9.854 8.5a1 1 0 0 0-1 1v4.5a1 1 0 0 0 1 1h4.5a1 1 0 0 0 .707-1.707l-4.5-4.5a1 1 0 0 0-.707-.293z" />
    </svg>
  );
};
