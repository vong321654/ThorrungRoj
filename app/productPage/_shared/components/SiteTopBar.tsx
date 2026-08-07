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
        gap: 1.5,
        alignItems: "center",
        flexWrap: "wrap",
        px: { xs: 2, md: 3 },
        py: 1.5,
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
          sx={{ fontWeight: 600 }}
        />
      ))}
    </Box>
  );
}