import type { SVGProps } from 'react';

/**
 * Inline SVG brand marks for Gmail and Google Drive. We avoid importing
 * Google's official logos as raster assets — keeping these as small inline
 * SVGs avoids both a network round-trip and the brand-guideline ambiguity
 * of redistributing vendor PNGs. The shapes are simplified, brand-correct
 * approximations that read as Gmail / Drive at 24×24px in the integrations
 * card grid.
 */
export const GmailLogoIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M3 7L12 13L21 7V17C21 18.1 20.1 19 19 19H5C3.9 19 3 18.1 3 17V7Z"
        fill="#EA4335"
      />
      <path d="M3 7L12 13L21 7L19 5H5L3 7Z" fill="#FBBC04" />
      <path d="M3 7V17C3 18.1 3.9 19 5 19H7V13L3 7Z" fill="#4285F4" />
      <path d="M21 7V17C21 18.1 20.1 19 19 19H17V13L21 7Z" fill="#34A853" />
    </svg>
  );
};

export const GoogleDriveLogoIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M9 3H15L21 14H15L9 3Z" fill="#FBBC04" />
      <path d="M3 19L9 8L12 13L9 19H3Z" fill="#1FA463" />
      <path d="M21 14L15 14L9 19H21L21 14Z" fill="#4285F4" />
    </svg>
  );
};
