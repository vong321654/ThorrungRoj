import type { SxProps, Theme } from "@mui/material/styles";

/**
 * สไตล์กลางของหน้า auth (login / admin login / จัดการแอดมิน)
 * ย้ายมาจาก Login.module.css เดิม เพื่อให้ทุกหน้าใช้ MUI sx ชุดเดียวกัน
 */

export const authPageSx: SxProps<Theme> = {
  alignItems: { xs: "flex-start", sm: "center" },
  bgcolor: "#f3f7f4",
  display: "flex",
  justifyContent: "center",
  minHeight: "calc(100vh - 65px)",
  px: { xs: 1.5, sm: 2 },
  py: { xs: 2.5, sm: 4 },
};

export const authCardSx: SxProps<Theme> = {
  bgcolor: "#ffffff",
  border: "1px solid #e0e8e2",
  borderRadius: { xs: "14px", sm: "18px" },
  boxShadow: "0 20px 55px rgba(22, 101, 52, 0.1)",
  maxWidth: 460,
  px: { xs: 2.5, sm: 4.5 },
  py: { xs: 3.25, sm: 4.5 },
  width: "100%",
};

export const brandMarkSx: SxProps<Theme> = {
  alignItems: "center",
  bgcolor: "#166534",
  borderRadius: "12px",
  color: "#ffffff",
  display: "flex",
  fontSize: "1rem",
  fontWeight: 800,
  height: 46,
  justifyContent: "center",
  letterSpacing: "0.04em",
  mx: "auto",
  width: 46,
};

export const adminBrandMarkSx: SxProps<Theme> = {
  ...brandMarkSx,
  bgcolor: "#1e293b",
};

export const eyebrowSx: SxProps<Theme> = {
  color: "#15803d",
  fontSize: "0.9rem",
  fontWeight: 800,
  textAlign: "center",
};

export const headingTitleSx: SxProps<Theme> = {
  color: "#17241b",
  fontSize: { xs: "1.5rem", sm: "1.85rem" },
  fontWeight: 700,
  mt: 0.75,
  textAlign: "center",
};

export const headingSubtitleSx: SxProps<Theme> = {
  color: "#6a786e",
  fontSize: "0.95rem",
  lineHeight: 1.55,
  mt: 1,
  textAlign: "center",
};

const alertBaseSx = {
  borderRadius: "9px",
  fontSize: "0.86rem",
  justifyContent: "center",
  mt: 2.25,
  py: 1.25,
};

export const errorAlertSx: SxProps<Theme> = {
  ...alertBaseSx,
  bgcolor: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
};

export const successAlertSx: SxProps<Theme> = {
  ...alertBaseSx,
  bgcolor: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
};

export const submitButtonSx: SxProps<Theme> = {
  bgcolor: "#166534",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "0.95rem",
  fontWeight: 700,
  minHeight: 46,
  textTransform: "none",
  "&:hover": { bgcolor: "#14532d" },
  "&.Mui-disabled": { bgcolor: "#166534", color: "#ffffff", opacity: 0.6 },
};

export const backLinkSx: SxProps<Theme> = {
  borderRadius: "10px",
  color: "#166534",
  display: "block",
  fontSize: "0.88rem",
  fontWeight: 700,
  mb: 1.5,
  px: 1.75,
  py: 1.25,
  textAlign: "center",
  textDecoration: "none",
  "&:hover": { bgcolor: "#f4f8f5", color: "#14532d" },
};

/** ทำให้ input มี font-size 16px กัน iOS ซูมอัตโนมัติตอนโฟกัส */
export const textFieldSx: SxProps<Theme> = {
  "& .MuiInputBase-input": { fontSize: 16 },
};
