"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { CurrentUser } from "@/app/models/user";
import LogoutButton from "./LogoutButton";

type CurrentUserResponse = {
  data: CurrentUser | null;
};

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);

  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (isAdminPath) return;

    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/users/me");
        if (!response.ok) return;

        const result = (await response.json()) as CurrentUserResponse;
        if (isMounted) setUser(result.data);
      } catch (error) {
        console.error("Failed to load current user:", error);
      }
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

      {user ? (
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
      ) : (
        <Link className="site-header__login" href="/login">
          เข้าสู่ระบบ
        </Link>
      )}
    </header>
  );
}
