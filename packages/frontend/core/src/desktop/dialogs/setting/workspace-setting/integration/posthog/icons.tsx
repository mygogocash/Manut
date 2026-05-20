import type { SVGProps } from 'react';

/**
 * Inline PostHog brand mark — three stacked rounded squares stylised as
 * the PostHog logo. Kept inline to match the existing icon pattern in
 * this directory. Renders in `currentColor` so it inherits the card
 * icon's monotone treatment.
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
      <path d="M5 4h6v6H5z" />
      <path d="M13 4h6v6h-6z" />
      <path d="M5 12h6v6H5z" />
      <path d="M13 12h6v6h-6z" opacity="0.5" />
    </svg>
  );
};
