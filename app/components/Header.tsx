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
