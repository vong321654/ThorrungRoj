"use client";

import liff from "@line/liff";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./Login.module.css";

const LIFF_ID = "2009558098-JoPkdhsJ";

export default function LoginPage() {
  const liffInitPromise = useRef<Promise<void> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hasLoggedOut] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("loggedOut"),
  );

  function initializeLiff() {
    if (!liffInitPromise.current) {
      liffInitPromise.current = liff.init({ liffId: LIFF_ID });
    }
    return liffInitPromise.current;
  }

  async function completeLineLogin() {
    const accessToken = liff.getAccessToken();
    if (!accessToken) {
      throw new Error("ไม่พบ LINE access token กรุณาเข้าสู่ระบบอีกครั้ง");
    }

    const response = await fetch("/api/auth/line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.error || "ไม่สามารถเข้าสู่ระบบด้วย LINE ได้");
    }

    sessionStorage.removeItem("lineLoginPending");
    window.location.replace("/productPage");
  }

  useEffect(() => {
    let isCancelled = false;

    async function resumeLineLogin() {
      try {
        await initializeLiff();
        const isPending = sessionStorage.getItem("lineLoginPending") === "1";

        if (!isCancelled && isPending && liff.isLoggedIn()) {
          setIsLoading(true);
          await completeLineLogin();
        }
      } catch (error) {
        if (!isCancelled) {
          setMessage(error instanceof Error ? error.message : "เริ่มต้น LINE Login ไม่สำเร็จ");
          setIsLoading(false);
        }
      }
    }

    resumeLineLogin();
    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleLineLogin() {
    setIsLoading(true);
    setMessage(null);

    try {
      await initializeLiff();

      if (!liff.isLoggedIn()) {
        sessionStorage.setItem("lineLoginPending", "1");
        liff.login();
        return;
      }

      await completeLineLogin();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ");
      setIsLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brandMark}>TR</div>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>ร้านแก๊สทอรุ่งโรจน์</p>
        </header>

        {hasLoggedOut && (
          <p className={styles.successMessage} role="status">
            ออกจากระบบเรียบร้อยแล้ว
          </p>
        )}

        {message && (
          <p className={styles.message} role="alert">
            {message}
          </p>
        )}

        <div className={styles.methods}>
          <button
            className={styles.lineButton}
            type="button"
            onClick={handleLineLogin}
            disabled={isLoading}
          >
            <span className={styles.lineIcon} aria-hidden="true">LINE</span>
            <span>
              <strong>{isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย LINE"}</strong>
            </span>
          </button>
        </div>

        <p className={styles.securityNote}>ระบบจะไม่เปิดเผยข้อมูลเข้าสู่ระบบของคุณแก่บุคคลอื่น</p>
      </section>
    </main>
  );
}
