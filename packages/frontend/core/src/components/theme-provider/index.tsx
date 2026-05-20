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
  return (
    // `defaultTheme="dark"` lands the brand decision from
    // IMPLEMENTATION_PLAN.md §B1 (decision #14): new users start in
    // dark mode. next-themes only consults `defaultTheme` when the
    // user has no stored preference, so existing users keep whatever
    // they last picked from Settings → Appearance.
    <NextThemeProvider themes={themes} enableSystem={true} defaultTheme="dark">
      {children}
      <ThemeObserver />
    </NextThemeProvider>
  );
};
