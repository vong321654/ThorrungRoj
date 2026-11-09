"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { belowHeaderMinHeightSx } from "@/app/components/UI/authStyles";
import type { USER } from "@/app/models/user";
import { loginUrlWithNext } from "@/app/util/loginRedirect";
import { getEditUserData } from "./allFunc";
import EditUserFields from "./EditUserFields";

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <Box
      component="main"
      sx={{
        ...belowHeaderMinHeightSx,
        bgcolor: "#f4f7f5",
        px: { xs: 1.5, sm: 2.5 },
        py: { xs: 2.75, sm: 6 },
      }}
    >
      {children}
    </Box>
  );
}

export default function EditUser() {
  const router = useRouter();
  const [user, setUser] = useState<USER | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadUser() {
      try {
        const result = await getEditUserData();
        if (isCancelled) return;

        if (!result) {
          router.replace(loginUrlWithNext("/manageUser/editUser"));
          return;
        }

        setUser(result);
      } catch (error) {
        if (!isCancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "ไม่สามารถโหลดข้อมูลผู้ใช้ได้",
          );
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    void loadUser();
    return () => {
      isCancelled = true;
    };
  }, [router]);

  if (isLoading) {
    return (
      <PageFrame>
        <Typography>กำลังโหลดข้อมูล...</Typography>
      </PageFrame>
    );
  }

  if (!user) {
    return (
      <PageFrame>
        <Typography role="alert">{message ?? "ไม่พบข้อมูลผู้ใช้"}</Typography>
      </PageFrame>
    );
  }

  const initial = user.name?.trim().charAt(0).toUpperCase() || "U";

  return (
    <PageFrame>
      <Paper
        component="section"
        aria-labelledby="edit-profile-title"
        elevation={0}
        sx={{
          border: "1px solid #e2e8e4",
          borderRadius: { xs: "14px", sm: "18px" },
          boxShadow: "0 18px 50px rgba(22, 101, 52, 0.08)",
          maxWidth: 760,
          mx: "auto",
          px: { xs: 2.25, sm: 4 },
          py: { xs: 2.75, sm: 4 },
        }}
      >
        <Button
          component={Link}
          href="/productPage"
          sx={{ color: "#4b6354", fontWeight: 600, mb: { xs: 1.5, sm: 2.5 }, ml: -1 }}
        >
          <span aria-hidden="true">←&nbsp;</span>กลับหน้าสินค้า
        </Button>

        <Box
          component="header"
          sx={{
            alignItems: { xs: "flex-start", sm: "center" },
            borderBottom: "1px solid #e8eee9",
            display: "flex",
            gap: { xs: 1.5, sm: 2.25 },
            pb: { xs: 2.5, sm: 3.5 },
          }}
        >
          <Avatar
            src={user.avatarUrl ?? undefined}
            alt={`รูปโปรไฟล์ของ ${user.name || "ผู้ใช้"}`}
            slotProps={{ img: { referrerPolicy: "no-referrer" } }}
            sx={{
              bgcolor: "#15803d",
              border: "4px solid #dcfce7",
              fontSize: { xs: "1.3rem", sm: "1.6rem" },
              fontWeight: 700,
              height: { xs: 60, sm: 76 },
              width: { xs: 60, sm: 76 },
            }}
          >
            {initial}
          </Avatar>

          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 1.25 }}>
              <Typography
                id="edit-profile-title"
                component="h1"
                sx={{ color: "#17241b", fontSize: { xs: "1.45rem", sm: "1.9rem" }, fontWeight: 700, lineHeight: 1.25 }}
              >
                แก้ไขข้อมูลส่วนตัว
              </Typography>
              <Chip
                size="small"
                label={user.isActive ? "บัญชีใช้งานอยู่" : "บัญชีถูกปิดใช้งาน"}
                sx={{
                  bgcolor: user.isActive ? "#dcfce7" : "#fee2e2",
                  color: user.isActive ? "#166534" : "#991b1b",
                  fontWeight: 700,
                }}
              />
            </Box>
            <Typography sx={{ color: "#66756b", mt: 0.875 }}>
              ปรับปรุงข้อมูลสำหรับการติดต่อและจัดส่งสินค้า
            </Typography>
          </Box>
        </Box>

        <EditUserFields
          initialValues={{
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: user.address,
          }}
        />
      </Paper>
    </PageFrame>
  );
}
