"use client";

import { useState } from "react";
import liff from "@line/liff";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import type { SxProps, Theme } from "@mui/material/styles";

type LogoutButtonProps = {
  /** แสดงเป็นรายการในเมนูบัญชีของจอมือถือ แทนปุ่มปกติ */
  asMenuItem?: boolean;
  sx?: SxProps<Theme>;
};

export default function LogoutButton({ asMenuItem = false, sx }: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });

      await liff.init({ liffId: "2009558098-JoPkdhsJ" });
      if (liff.isLoggedIn()) {
        liff.logout();
      }
    } catch {
      // The redirect below completes local logout even if LIFF cleanup fails.
    } finally {
      window.location.replace("/login?loggedOut=1");
    }
  }

  const label = isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ";

  if (asMenuItem) {
    return (
      <MenuItem onClick={handleLogout} disabled={isLoggingOut} sx={sx}>
        {label}
      </MenuItem>
    );
  }

  return (
    <Button
      type="button"
      variant="outlined"
      color="error"
      onClick={handleLogout}
      disabled={isLoggingOut}
      sx={sx}
    >
      {label}
    </Button>
  );
}
