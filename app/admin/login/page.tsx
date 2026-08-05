"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import styles from "../../login/Login.module.css";

export default function AdminLoginPage() {
  const [message, setMessage] = useState<string | null>(null);

  function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("ระบบเข้าสู่ระบบ Admin ยังไม่ได้เชื่อมต่อ backend");
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

        <form className={styles.emailForm} onSubmit={handleAdminLogin}>
          <div className={styles.field}>
            <label htmlFor="admin-email">อีเมล</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              autoComplete="username"
              required
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
              minLength={8}
              required
            />
          </div>

          <button className={styles.submitButton} type="submit">
            เข้าสู่ระบบ Admin
          </button>
        </form>

        <Link className={styles.userLoginLink} href="/login">
          ← กลับไปเข้าสู่ระบบสำหรับลูกค้า
        </Link>

        <p className={styles.securityNote}>ห้ามเปิดเผยอีเมลและรหัสผ่านให้บุคคลอื่น</p>
      </section>
    </main>
  );
}
