"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { CURRENTUSER } from "@/app/models/user";
import LogoutButton from "./LogoutButton";
import { createClient } from "@/app/api/util/supabase/client";

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

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<CURRENTUSER | null>(null);

  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (isAdminPath) return;

    let isMounted = true;
    const supabase = createClient();

    async function loadCurrentUser() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (session?.user && !isLineUser(session.user)) {
          await supabase.auth.signOut({ scope: "local" });
          if (isMounted) {
            window.location.replace("/login?reason=line-required");
          }
          return;
        }

        const accessToken = session?.access_token;
        if (!accessToken) return;

        const response = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) return;

        const result = (await response.json()) as CurrentUserResponse;
        if (isMounted && result.status === "success") setUser(result.results);
      } catch {}
    }

    void loadCurrentUser();
    return () => {
      isMounted = false;
    };
  }, [isAdminPath]);

  if (isAdminPath) return null;

  const initial = user?.name?.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="site-header">
      <div className="site-header__brand">ร้านแก๊สทอรุ่งโรจน์</div>

      {user && (
        <div className="site-header__user" aria-label={`ผู้ใช้ ${user.name ?? "ผู้ใช้"}`}>
          <span className="site-header__user-name">{user.name || "ผู้ใช้"}</span>
          {user.avatarUrl ? (
            <img
              className="site-header__avatar"
              src={user.avatarUrl}
              alt={`รูปโปรไฟล์ ${user.name ?? "ผู้ใช้"}`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="site-header__avatar site-header__avatar--fallback" aria-hidden="true">
              {initial}
            </span>
          )}
          <Link className="site-header__edit" href="/manageUser/editUser">
            แก้ไขข้อมูลส่วนตัว
          </Link>
          <LogoutButton />
        </div>
      )}

    </header>
  );
}
