"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/api/util/supabase/client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import {
  authCardSx,
  authPageSx,
  brandMarkSx,
  errorAlertSx,
  eyebrowSx,
  successAlertSx,
} from "@/app/components/UI/authStyles";

function subscribeToLocation() {
  return () => {};
}

function getLoggedOutSnapshot() {
  return new URLSearchParams(window.location.search).has("loggedOut");
}

function getAuthErrorSnapshot() {
  return new URLSearchParams(window.location.search).has("error");
}

function getServerLoggedOutSnapshot() {
  return false;
}

function isLineUser(user: {
  app_metadata?: { provider?: string };
  identities?: Array<{ provider?: string }>;
}) {
  return (
    user.app_metadata?.provider === "line" ||
    user.app_metadata?.provider === "custom:line-liff" ||
    user.identities?.some(
      (identity) => identity.provider === "line" || identity.provider === "custom:line-liff",
    )
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const hasLoggedOut = useSyncExternalStore(
    subscribeToLocation,
    getLoggedOutSnapshot,
    getServerLoggedOutSnapshot,
  );
  const hasAuthError = useSyncExternalStore(
    subscribeToLocation,
    getAuthErrorSnapshot,
    getServerLoggedOutSnapshot,
  );

  useEffect(() => {
    let isCancelled = false;
    const supabase = createClient();

    async function redirectAuthenticatedUser() {
      const { data } = await supabase.auth.getUser();
      if (data.user && !isLineUser(data.user)) {
        await supabase.auth.signOut({ scope: "local" });
        return;
      }

      if (!isCancelled && data.user) {
        router.replace("/productPage");
      }
    }

    void redirectAuthenticatedUser();
    return () => {
      isCancelled = true;
    };
  }, [router]);

  async function handleLineLogin() {
    setIsLoading(true);
    setMessage(null);

    try {
      // วิธีใหม่: ให้ Supabase Auth เริ่ม LINE OAuth และดูแล session
      // เมื่อล็อกอินสำเร็จ LINE จะส่งกลับมาที่ /api/auth/line
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "custom:line-liff",
        options: {
          redirectTo: `${window.location.origin}/api/auth/line`,
        },
      });

      if (error) throw error;
      if (data.url) window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ");
      setIsLoading(false);
    }
  }

  return (
    <Box component="main" sx={authPageSx}>
      <Paper component="section" aria-labelledby="loginTitle" elevation={0} sx={authCardSx}>
        <Box sx={brandMarkSx}>TR</Box>

        <Typography id="loginTitle" component="h1" sx={{ ...eyebrowSx, mt: 2.5 }}>
          ร้านแก๊สทอรุ่งโรจน์
        </Typography>

        {hasLoggedOut && (
          <Alert icon={false} severity="success" role="status" sx={successAlertSx}>
            ออกจากระบบเรียบร้อยแล้ว
          </Alert>
        )}

        {(message || hasAuthError) && (
          <Alert icon={false} severity="warning" role="alert" sx={errorAlertSx}>
            {message ?? "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองอีกครั้ง"}
          </Alert>
        )}

        <Button
          type="button"
          onClick={handleLineLogin}
          disabled={isLoading}
          disableElevation
          fullWidth

          sx={{
            bgcolor: "#06c755",
            border: "1px solid #06c755",
            borderRadius: "12px",
            color: "#ffffff",
            fontSize: "0.95rem",
            fontWeight: 700,
            justifyContent: "flex-start",
            minHeight: 68,
            mt: 3.5,
            px: 2,
            py: 1.5,
            textTransform: "none",
            transition: "background-color 150ms ease, transform 150ms ease",
            "& .MuiButton-startIcon": { mr: 1.75 },
            "&:hover": {
              bgcolor: "#05b84e",
              transform: "translateY(-1px)",
            },
            "&.Mui-disabled": {
              bgcolor: "#06c755",
              color: "#ffffff",
              cursor: "wait",
              opacity: 0.7,
            },
          }}
        >
          {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย LINE"}
        </Button>

        <Typography
          sx={{
            color: "#7c8980",
            fontSize: "0.75rem",
            lineHeight: 1.5,
            mt: 3,
            textAlign: "center",
          }}
        >
          ระบบจะไม่เปิดเผยข้อมูลเข้าสู่ระบบของคุณแก่บุคคลอื่น
        </Typography>
      </Paper>
    </Box>
  );
}
