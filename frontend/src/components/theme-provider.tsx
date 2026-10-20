"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

// Page-background colours, kept in sync with --neutral-950 in globals.css.
const THEME_COLOR = { light: "#F6F5F1", dark: "#0B0E13" } as const;

/**
 * Keeps <meta name="theme-color"> matching the *effective* theme. The static
 * `viewport.themeColor` in layout.tsx only follows the OS setting, so without
 * this a user who picks "Light" on a dark-mode phone would keep a dark browser
 * bar around a light page.
 */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    const color = THEME_COLOR[resolvedTheme];
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute("content", color));
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
