"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

export default function ShopContactFooter() {
  return (
    <Box sx={{ bgcolor: "#0369a1", color: "#fff", px: { xs: 2, md: 4 }, py: 2, mt: "auto" }}>
      <Grid container spacing={1}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="body2">ท.รุ่งโรจน์2015 เบอร์โทร : 089-8200301 (หลัก)</Typography>
          <Typography variant="body2">เบอร์โทร : 087-1680639 (รอง)</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ textAlign: { sm: "right" } }}>
          <Typography variant="body2">ที่อยู่ : เลขที่ 12/213 ซอย หมู่บ้านเขาน้อย</Typography>
          <Typography variant="body2">ตำบลหัวหิน อำเภอหัวหิน ประจวบคีรีขันธ์ 77110</Typography>
        </Grid>
      </Grid>
    </Box>
  );
}