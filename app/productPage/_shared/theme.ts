import { createTheme } from "@mui/material/styles";

// อุปกรณ์สัมผัสต้องมีพื้นที่กดอย่างน้อย 44px ไม่ว่าจอจะกว้างแค่ไหน (เช่น iPad แนวนอน)
const TOUCH_DEVICE = "@media (pointer: coarse)";

export const productPageTheme = createTheme({
  palette: {
    primary: { main: "#15803d" },
    secondary: { main: "#ea580c" },
    error: { main: "#dc2626" },
    background: { default: "#f3f4f6" },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: { root: { [TOUCH_DEVICE]: { minHeight: 44 } } },
    },
    MuiIconButton: {
      styleOverrides: { root: { [TOUCH_DEVICE]: { minHeight: 44, minWidth: 44 } } },
    },
    MuiMenuItem: {
      styleOverrides: { root: { [TOUCH_DEVICE]: { minHeight: 44 } } },
    },
  },
});
