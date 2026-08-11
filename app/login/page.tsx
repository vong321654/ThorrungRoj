"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/api/util/supabase/client";
import styles from "./Login.module.css";

/*
 * วิธีล็อกอินเดิม (ปิดใช้งานแล้ว)
 *
 * import liff from "@line/liff";
 * const LIFF_ID = "2009558098-JoPkdhsJ";
 * await liff.init({ liffId: LIFF_ID });
 * if (!liff.isLoggedIn()) liff.login();
 * const accessToken = liff.getAccessToken();
 * await fetch("/api/auth/line", { method: "POST", body: JSON.stringify({ accessToken }) });
 *
 * วิธีนี้สร้าง custom JWT cookie เอง จึงไม่เกิด Supabase Auth session
 * และ auth.uid() ใน RLS ไม่สามารถระบุผู้ใช้ LINE ได้
 */

function subscribeToLocation() {
  return () => {};
}

function getLoggedOutSnapshot() {
  return new URLSearchParams(window.location.search).has("loggedOut");
}

function getAuthErrorSnapshot() {
  return new URLSearchParams(window.location.search).has("error");
}

function getServerLoggedOutSnapshot() {
  return false;
}

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

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const hasLoggedOut = useSyncExternalStore(
    subscribeToLocation,
    getLoggedOutSnapshot,
    getServerLoggedOutSnapshot,
  );
  const hasAuthError = useSyncExternalStore(
    subscribeToLocation,
    getAuthErrorSnapshot,
    getServerLoggedOutSnapshot,
  );

  useEffect(() => {
    let isCancelled = false;
    const supabase = createClient();

    async function redirectAuthenticatedUser() {
      const { data } = await supabase.auth.getUser();
      if (data.user && !isLineUser(data.user)) {
        await supabase.auth.signOut({ scope: "local" });
        return;
      }

      if (!isCancelled && data.user) {
        router.replace("/productPage");
      }
    }

    void redirectAuthenticatedUser();
    return () => {
      isCancelled = true;
    };
  }, [router]);

  async function handleLineLogin() {
    setIsLoading(true);
    setMessage(null);

    try {
      // วิธีใหม่: ให้ Supabase Auth เริ่ม LINE OAuth และดูแล session
      // เมื่อล็อกอินสำเร็จ LINE จะส่งกลับมาที่ /api/auth/line
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "custom:line-liff",
        options: {
          redirectTo: `${window.location.origin}/api/auth/line`,
        },
      });

      if (error) throw error;
      if (data.url) window.location.assign(data.url);
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

        {hasAuthError && !message && (
          <p className={styles.message} role="alert">
            เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองอีกครั้ง
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
