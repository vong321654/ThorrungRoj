import { getCurrentUser } from "@/app/api/services/userService";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

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
          <Link className="site-header__edit" href="/manageUser/editUser">
            แก้ไขข้อมูลส่วนตัว
          </Link>
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
