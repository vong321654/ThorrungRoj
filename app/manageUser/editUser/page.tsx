"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@/app/models/user";
import { getEditUserData } from "./allFunc";
import EditUserFields from "./EditUserFields";
import styles from "./EditUser.module.css";

export default function EditUser() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadUser() {
      try {
        const result = await getEditUserData();
        if (isCancelled) return;

        if (!result) {
          router.replace("/login");
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
      <main className={styles.page}>
        <p>กำลังโหลดข้อมูล...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <p role="alert">{message ?? "ไม่พบข้อมูลผู้ใช้"}</p>
      </main>
    );
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
              <span
                className={
                  user.isActive ? styles.activeBadge : styles.inactiveBadge
                }
              >
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
