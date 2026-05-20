import type { FC, ImgHTMLAttributes } from 'react';

import manutLogoSrc from './assets/manut-logo.jpeg';

/**
 * Canonical Manut brand mark, displayed on auth pages (sign-in, magic link,
 * OAuth callback) and the marketing-style "other page" layout shell.
 *
 * Was previously a stylized "M" SVG lettermark (`fill="currentColor"`). The
 * user flagged that the auth pages still surfaced the bare letter while the
 * landing site already used the full Newton-with-prism brand illustration
 * (manut-landing/public/manut-logo.jpeg). This component is the source of
 * truth for both call sites — auth-header.tsx and the other-page-layout
 * navbar — so swapping the implementation here updates both at once.
 *
 * Keeps the same exported name (`ManutLogoIcon`) so existing imports compile
 * unchanged. Default size 24×24 (matches the prior SVG default and existing
 * CSS sizing). The image is square; `borderRadius` gives it the same
 * polished rounded-corner look used on the landing site.
 */
export const ManutLogoIcon: FC<ImgHTMLAttributes<HTMLImageElement>> = ({
  width = 24,
  height = 24,
  alt = 'Manut',
  className,
  style,
  ...rest
}) => {
  return (
    <img
      src={manutLogoSrc}
      width={width}
      height={height}
      alt={alt}
      className={className}
      style={{ borderRadius: 4, objectFit: 'cover', ...style }}
      {...rest}
    />
  );
};
