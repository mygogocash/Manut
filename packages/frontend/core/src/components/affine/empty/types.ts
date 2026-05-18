import type { HTMLAttributes, ReactNode } from 'react';

export interface EmptyLayoutProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  /**
   * Inline themeable illustration (Manut visual identity).
   * When provided, takes precedence over `illustrationLight`/`illustrationDark`
   * — the layout renders this node in place of `<ThemedImg>`.
   *
   * The node receives no extra props; consumers should size it via the
   * component's own props (e.g. `<EmptyDocsIllustration size={300} />`).
   */
  illustration?: ReactNode;

  /**
   * Legacy raster illustration (PNG/SVG URL). Optional because callers
   * can now pass an inline `illustration` instead.
   */
  illustrationLight?: string;
  /** Dark-mode variant of the legacy raster illustration. */
  illustrationDark?: string;
  illustrationWidth?: number | string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;

  /**
   * Absolute center the content, useful for full screen empty states (e.g. mobile page)
   */
  absoluteCenter?: boolean;
}

export type UniversalEmptyProps = Partial<EmptyLayoutProps>;
