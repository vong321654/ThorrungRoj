'use client';

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { belowHeaderMinHeightSx } from "@/app/components/UI/authStyles";

export default function ManageUserPage() {
  return (
    <Box
      component="main"
      sx={{ ...belowHeaderMinHeightSx, alignItems: "center", display: "flex", justifyContent: "center", p: 2 }}
    >
      <Paper sx={{ maxWidth: 480, p: { xs: 3, sm: 4 }, width: "100%" }}>
        <Typography component="h1" variant="h5" sx={{ fontWeight: 700, mb: 2 }}>จัดการผู้ใช้งาน...</Typography>
        <Typography>หน้านี้กำลังอยู่ระหว่างการพัฒนา...</Typography>
      </Paper>
    </Box>
  );
}
