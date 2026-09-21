"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { hasActiveAdminSession, loginWithEmail } from "./allFunc";
import { useAdminSession } from "../AdminSessionContext";
import {
  adminBrandMarkSx,
  authCardSx,
  authPageSx,
  errorAlertSx,
  eyebrowSx,
  headingSubtitleSx,
  headingTitleSx,
  submitButtonSx,
  textFieldSx,
} from "@/app/components/UI/authStyles";

export default function AdminLoginPage() {
  const router = useRouter();
  const { refresh } = useAdminSession();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [adminPassword, setAdminPassword] = useState<string>("");

  useEffect(() => {
    let isCancelled = false;

    async function redirectAuthenticatedAdmin() {
      const hasSession = await hasActiveAdminSession();
      if (!isCancelled && hasSession) {
        router.replace("/admin");
      }
    }

    void redirectAuthenticatedAdmin();
    return () => {
      isCancelled = true;
    };
  }, [router]);

  async function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      await loginWithEmail(adminEmail, adminPassword);
      await refresh();
      router.replace("/admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to sign in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box
      component="main"
      sx={{
        ...authPageSx,
        flex: 1,
        minHeight: "100dvh",
        p: "clamp(16px, 4vw, 48px)",
      }}
    >
      <Paper
        component="section"
        aria-labelledby="adminLoginTitle"
        elevation={0}
        sx={{
          ...authCardSx,
          overflowWrap: "anywhere",
          p: "clamp(20px, 5vw, 36px)",
        }}
      >
        <Box sx={adminBrandMarkSx}>A</Box>

        <Box sx={{ mt: 2.5 }}>
          <Typography sx={eyebrowSx}>ร้านแก๊สทอรุ่งโรจน์</Typography>
          <Typography id="adminLoginTitle" component="h1" sx={headingTitleSx}>
            เข้าสู่ระบบ Admin
          </Typography>
          <Typography sx={headingSubtitleSx}>
            สำหรับผู้ดูแลระบบและพนักงานที่ได้รับสิทธิ์เท่านั้น
          </Typography>
        </Box>

        {message && (
          <Alert icon={false} severity="warning" role="alert" sx={errorAlertSx}>
            {message}
          </Alert>
        )}

        <Stack component="form" method="post" onSubmit={handleAdminLogin} spacing={2} sx={{ mt: 3.5 }}>
          <TextField
            id="adminEmail"
            name="email"
            type="email"
            label="อีเมล"
            placeholder="admin@example.com"
            autoComplete="username"
            required
            fullWidth
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
            sx={textFieldSx}
          />

          <TextField
            id="adminPassword"
            name="password"
            type="password"
            label="รหัสผ่าน"
            placeholder="กรอกรหัสผ่าน"
            autoComplete="current-password"
            required
            fullWidth
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
            slotProps={{ htmlInput: { minLength: 6 } }}
            sx={textFieldSx}
          />

          <Button type="submit" disabled={isSubmitting} disableElevation fullWidth sx={submitButtonSx}>
            เข้าสู่ระบบ Admin
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
