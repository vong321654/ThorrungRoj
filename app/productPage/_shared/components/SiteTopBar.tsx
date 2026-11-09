"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";

const PARTNER_BRANDS = [
  { id: "worldGas", label: "เวิลด์แก๊ส", color: "#16a34a" },
  { id: "siamGas", label: "สยามแก๊ส", color: "#2563eb" },
  { id: "ptt", label: "ปตท. ก๊าซหุงต้ม", color: "#0f9b8e" },
] as const;

export default function SiteTopBar() {
  return (
    <Box
      sx={{
        display: "flex",
        gap: { xs: 1, sm: 1.5 },
        alignItems: "center",
        // จอมือถือ: เลื่อนข้างแถวเดียว ไม่กินพื้นที่แนวตั้งก่อนถึงรายการสินค้า
        flexWrap: { xs: "nowrap", sm: "wrap" },
        overflowX: { xs: "auto", sm: "visible" },
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
        px: { xs: 2, md: 3 },
        py: { xs: 1, sm: 1.5 },
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      {PARTNER_BRANDS.map((brand) => (
        <Chip
          key={brand.id}
          avatar={<Avatar sx={{ bgcolor: brand.color }}>{brand.label.charAt(0)}</Avatar>}
          label={brand.label}
          variant="outlined"
          sx={{ flexShrink: 0, fontWeight: 600 }}
        />
      ))}
    </Box>
  );
}