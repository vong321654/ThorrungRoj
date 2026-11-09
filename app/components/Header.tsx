"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import type { CURRENTUSER } from "@/app/models/user";
import LogoutButton from "./LogoutButton";
import { createClient } from "@/app/api/util/supabase/client";

// ต้องตรงกับ belowHeaderMinHeightSx ใน UI/authStyles.ts
const HEADER_HEIGHT = 64;

const avatarSx = {
  bgcolor: "#15803d",
  border: "2px solid #dcfce7",
  fontSize: "0.875rem",
  fontWeight: 700,
  height: 40,
  width: 40,
};

const headerActionSx = {
  fontSize: "0.875rem",
  fontWeight: 600,
  minHeight: 44,
  textTransform: "none",
  whiteSpace: "nowrap",
};

type CurrentUserResponse = {
  status: "success" | "error";
  message: string;
  results: CURRENTUSER | null;
};

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

type CurrentUserLoadResult = {
  user: CURRENTUSER | null;
  redirectTo: string | null;
};

let pendingCurrentUserRequest: Promise<CurrentUserLoadResult> | null = null;

function loadCurrentUser() {
  if (pendingCurrentUserRequest) return pendingCurrentUserRequest;

  const request = (async (): Promise<CurrentUserLoadResult> => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.user && !isLineUser(session.user)) {
      await supabase.auth.signOut({ scope: "local" });
      return { user: null, redirectTo: "/login?reason=line-required" };
    }

    const accessToken = session?.access_token;
    if (!accessToken) return { user: null, redirectTo: null };

    const response = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return { user: null, redirectTo: null };

    const result = (await response.json()) as CurrentUserResponse;
    return {
      user: result.status === "success" ? result.results : null,
      redirectTo: null,
    };
  })();

  pendingCurrentUserRequest = request;
  void request.then(
    () => {
      if (pendingCurrentUserRequest === request) pendingCurrentUserRequest = null;
    },
    () => {
      if (pendingCurrentUserRequest === request) pendingCurrentUserRequest = null;
    },
  );
  return request;
}

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<CURRENTUSER | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (isAdminPath) return;

    let isMounted = true;

    async function updateCurrentUser() {
      try {
        const result = await loadCurrentUser();
        if (!isMounted) return;
        if (result.redirectTo) {
          window.location.replace(result.redirectTo);
          return;
        }
        setUser(result.user);
      } catch {}
    }

    void updateCurrentUser();
    return () => {
      isMounted = false;
    };
  }, [isAdminPath]);

  if (isAdminPath) return null;

  const initial = user?.name?.trim().charAt(0).toUpperCase() || "U";
  const displayName = user?.name || "ผู้ใช้";
  const avatar = (
    <Avatar
      src={user?.avatarUrl ?? undefined}
      alt={`รูปโปรไฟล์ ${displayName}`}
      slotProps={{ img: { referrerPolicy: "no-referrer" } }}
      sx={avatarSx}
    >
      {initial}
    </Avatar>
  );

  return (
    <Box
      component="header"
      sx={{
        alignItems: "center",
        bgcolor: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        gap: 1,
        justifyContent: "space-between",
        minHeight: HEADER_HEIGHT,
        px: { xs: 2, sm: 3, md: 6 },
        py: 1,
      }}
    >
      <Typography
        component="div"
        noWrap
        sx={{ color: "#166534", fontSize: { xs: "1rem", sm: "1.125rem" }, fontWeight: 700, minWidth: 0 }}
      >
        ร้านแก๊สท.รุ่งโรจน์
      </Typography>

      {user && (
        <>
          {/* แท็บเล็ตขึ้นไป: แสดงปุ่มเรียงในแถบเลย ส่วนชื่อแสดงเมื่อจอกว้างพอ (md) */}
          <Box
            aria-label={`ผู้ใช้ ${displayName}`}
            sx={{ alignItems: "center", display: { xs: "none", sm: "flex" }, flexShrink: 0, gap: 1.25 }}
          >
            <Typography
              noWrap
              sx={{ color: "#374151", display: { xs: "none", md: "block" }, fontSize: "0.9375rem", fontWeight: 600, maxWidth: 180 }}
            >
              {displayName}
            </Typography>
            {avatar}
            <Button component={Link} href="/manageUser/editUser" variant="outlined" color="success" sx={headerActionSx}>
              แก้ไขข้อมูลส่วนตัว
            </Button>
            <LogoutButton sx={headerActionSx} />
          </Box>

          {/* มือถือ: แถบกว้างไม่พอ จึงรวมคำสั่งไว้ในเมนูที่เปิดจากรูปโปรไฟล์ */}
          <IconButton
            aria-label="เมนูบัญชีผู้ใช้"
            aria-haspopup="menu"
            aria-expanded={menuAnchor ? "true" : undefined}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            sx={{ display: { xs: "inline-flex", sm: "none" }, flexShrink: 0, height: 44, p: 0, width: 44 }}
          >
            {avatar}
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
          >
            <ListSubheader
              component="div"
              sx={{ lineHeight: 2.5, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {displayName}
            </ListSubheader>
            <MenuItem component={Link} href="/manageUser/editUser" onClick={() => setMenuAnchor(null)} sx={{ minHeight: 44 }}>
              แก้ไขข้อมูลส่วนตัว
            </MenuItem>
            <LogoutButton asMenuItem sx={{ color: "error.main", minHeight: 44 }} />
          </Menu>
        </>
      )}
    </Box>
  );
}
