"use client";

import { useState } from "react";
import liff from "@line/liff";

export default function LogoutButton() {
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

  return (
    <button
      className="site-header__logout"
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
    >
      {isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
    </button>
  );
}
