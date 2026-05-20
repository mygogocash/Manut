import type { SVGProps } from 'react';

/**
 * Inline MongoDB leaf glyph. Kept inline (no external asset) to match
 * the Gmail / Drive / GitHub icon pattern in this directory and avoid
 * the brand-guideline ambiguity of redistributing vendor PNGs. Drawn
 * as a single-color leaf at 24×24px so it inherits the integration
 * card's `currentColor`.
 */
export const MongoDbLogoIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 2c-.25 1.7-1.3 3-2.4 4.5C7.95 8.55 6 11.2 6 14.6c0 3.4 2.05 6 5 7l.6.4c.1-2.6.4-5 .4-7.5V2zm.7 0v22h.7c-.05-2.45-.35-4.95-.35-7.45 0-2.5.25-5 .35-7.55-.1-3-.2-5-.7-7z" />
    </svg>
  );
};
