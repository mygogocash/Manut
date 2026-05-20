import type { SVGProps } from 'react';

/**
 * Inline GoGoCash brand mark — internal product, no published
 * brand guidelines. We render a stylised "G" inside a soft
 * rounded square, hand-drawn at 24×24px to match the surrounding
 * Manut connectors. The colored circular plate supplies the
 * brand violet (#7C3AED) and this glyph paints white on top.
 *
 * Path is original — drawn for Manut, not adapted from a third
 * party — so there's no upstream licence to attribute.
 */
export const GoGoCashLogoIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5 1.25 1.25 0 1 0-2.5 0 6 6 0 1 1-6-6 5.97 5.97 0 0 1 4.06 1.59 1.25 1.25 0 0 0 1.69-1.84A8.46 8.46 0 0 0 12 3.5Zm1.25 7.25a1.25 1.25 0 0 0 0 2.5h2.5v.5a3.75 3.75 0 1 1-3.75-3.75 1.25 1.25 0 0 0 0-2.5 6.25 6.25 0 1 0 6.25 6.25v-1.75A1.25 1.25 0 0 0 17 10.75Z" />
    </svg>
  );
};
