import Link from "next/link";
import { redirect } from "next/navigation";
import { getEditUserData } from "./allFunc";
import EditUserFields from "./EditUserFields";
import styles from "./EditUser.module.css";

export default async function EditUser() {
  const user = await getEditUserData();
  if (!user) {
    redirect("/login");
  }

  const initial = user.name?.trim().charAt(0).toUpperCase() || "U";

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="edit-profile-title">
        <Link className={styles.backLink} href="/productPage">
          <span aria-hidden="true">←</span> กลับหน้าสินค้า
        </Link>

        <header className={styles.header}>
          {user.avatarUrl ? (
            <img
              className={styles.avatar}
              src={user.avatarUrl}
              alt={`รูปโปรไฟล์ของ ${user.name || "ผู้ใช้"}`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true">
              {initial}
            </span>
          )}

          <div>
            <div className={styles.titleRow}>
              <h1 id="edit-profile-title">แก้ไขข้อมูลส่วนตัว</h1>
              <span className={user.isActive ? styles.activeBadge : styles.inactiveBadge}>
                {user.isActive ? "บัญชีใช้งานอยู่" : "บัญชีถูกปิดใช้งาน"}
              </span>
            </div>
            <p>ปรับปรุงข้อมูลสำหรับการติดต่อและจัดส่งสินค้า</p>
          </div>
        </header>

        <EditUserFields
          initialValues={{
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: user.address,
          }}
        />
      </section>
    </main>
  );
}
