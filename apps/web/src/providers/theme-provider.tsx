"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

const ThemesProvider = NextThemesProvider as React.ComponentType<
  React.ComponentProps<typeof NextThemesProvider> & {
    children?: React.ReactNode;
  }
>;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemesProvider>
  );
}
