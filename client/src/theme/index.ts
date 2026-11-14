import { createTheme, Theme, ThemeOptions } from "@mui/material/styles";
import { breakpoints } from "./breakpoints";
import { components } from "./components";
import { darkPalette, lightPalette } from "./palette";
import { typography } from "./typography";
export { colors } from "./colors";

const createThemeConfig = (mode: "light" | "dark"): ThemeOptions => ({
  palette: mode === "dark" ? darkPalette : lightPalette,
  typography,
  breakpoints,
  components,
  shape: {
    borderRadius: 8,
  },
});

export const lightTheme: Theme = createTheme(createThemeConfig("light"));
export const darkTheme: Theme = createTheme(createThemeConfig("dark"));

export const getTheme = (mode: "light" | "dark" = "light"): Theme => {
  return mode === "dark" ? darkTheme : lightTheme;
};

export default lightTheme;
