import { AppThemeService } from '@affine/core/modules/theme';
import { useService } from '@toeverything/infra';
import { ThemeProvider as NextThemeProvider, useTheme } from 'next-themes';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';

const themes = ['dark', 'light'];

function ThemeObserver() {
  const { resolvedTheme } = useTheme();
  const service = useService(AppThemeService);

  useEffect(() => {
    service.appTheme.theme$.next(resolvedTheme);
  }, [resolvedTheme, service.appTheme.theme$]);

  return null;
}

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  // Manut Gen-Z identity defaults new users to dark mode; system
  // preference still takes over once enableSystem resolves it, and
  // returning users keep whatever they previously chose because
  // next-themes persists `theme` in localStorage.
  return (
    <NextThemeProvider themes={themes} defaultTheme="dark" enableSystem={true}>
      {children}
      <ThemeObserver />
    </NextThemeProvider>
  );
};
