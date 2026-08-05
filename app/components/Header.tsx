import { createAdminClient } from "@/app/api/util/supabase/admin";
import { cookies } from "next/headers";
import jwt, { type JwtPayload } from "jsonwebtoken";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

type CurrentUser = {
  name: string | null;
  avatarUrl: string | null;
};

async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token || !jwtSecret) {
    return null;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload === "string" || !("userId" in payload)) {
      return null;
    }

    const userId = (payload as JwtPayload & { userId?: string | number }).userId;
    if (!userId) {
      return null;
    }

    const { data, error } = await createAdminClient()
      .from("users")
      .select("name, avatarUrl")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("HEADER USER ERROR:", error.message);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export default async function Header() {
  const user = await getCurrentUser();
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
          <LogoutButton />
        </div>
      )}

      {!user && (
        <Link className="site-header__login" href="/login">
          เข้าสู่ระบบ
        </Link>
      )}
    </header>
  );
}
