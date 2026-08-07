import { createTheme } from "@mui/material/styles";

export const productPageTheme = createTheme({
  palette: {
    primary: { main: "#15803d" },
    secondary: { main: "#ea580c" },
    error: { main: "#dc2626" },
    background: { default: "#f3f4f6" },
  },
  shape: { borderRadius: 10 },
});