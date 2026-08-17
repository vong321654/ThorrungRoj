"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import styles from "../../login/Login.module.css";
import { hasActiveAdminSession, loginWithEmail } from "./allFunc";
import { useAdminSession } from "../AdminSessionContext";

export default function AdminLoginPage() {
  const router = useRouter();
  const { refresh } = useAdminSession();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [adminPassword, setAdminPassword] = useState<string>("");

  useEffect(() => {
    let isCancelled = false;

    async function redirectAuthenticatedAdmin() {
      const hasSession = await hasActiveAdminSession();
      if (!isCancelled && hasSession) {
        router.replace("/admin");
      }
    }

    void redirectAuthenticatedAdmin();
    return () => {
      isCancelled = true;
    };
  }, [router]);

  async function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      await loginWithEmail(adminEmail, adminPassword);
      await refresh();
      router.replace("/admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to sign in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="admin-login-title">
        <div className={`${styles.brandMark} ${styles.adminBrandMark}`}>A</div>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>ร้านแก๊สทอรุ่งโรจน์</p>
          <h1 id="admin-login-title">เข้าสู่ระบบ Admin</h1>
          <p>สำหรับผู้ดูแลระบบและพนักงานที่ได้รับสิทธิ์เท่านั้น</p>
        </header>

        {message && (
          <p className={styles.message} role="alert">
            {message}
          </p>
        )}

        <form className={styles.emailForm} method="post" onSubmit={handleAdminLogin}>
          <div className={styles.field}>
            <label htmlFor="admin-email">อีเมล</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              autoComplete="username"
              required
              onChange={(e) => setAdminEmail(e.target.value)}
              value={adminEmail}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="admin-password">รหัสผ่าน</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              placeholder="กรอกรหัสผ่าน"
              autoComplete="current-password"
              minLength={6}
              required
              onChange={(e) => setAdminPassword(e.target.value)}
              value={adminPassword}
            />
          </div>

          <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
            เข้าสู่ระบบ Admin
          </button>
        </form>

      </section>
    </main>
  );
}
