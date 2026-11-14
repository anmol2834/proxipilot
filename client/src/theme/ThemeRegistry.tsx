"use client";

import * as React from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useUIStore } from "@/stores/ui.store";
import { darkTheme, lightTheme } from "./index";

interface ThemeRegistryProps {
  children: React.ReactNode;
}

export function ThemeRegistry({ children }: ThemeRegistryProps) {
  const themeMode = useUIStore((state) => state.themeMode);
  const theme = React.useMemo(() => (themeMode === "dark" ? darkTheme : lightTheme), [themeMode]);

  // Keep data-theme attribute in sync on html document element for SCSS CSS variables
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", themeMode);
    }
  }, [themeMode]);

  return (
    <AppRouterCacheProvider options={{ key: "proxipilot-mui", enableCssLayer: false }}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
