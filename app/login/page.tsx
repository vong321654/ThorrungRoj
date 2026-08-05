"use client";

import { useEffect, useRef, useState } from "react";
import liff from "@line/liff";
import { env } from "process";

const LIFF_ID = process.env.LINE_LIFF_ID || "";

export default function LineLogin() {
  const hasInitialized = useRef(false);
  const [hasLoggedOut] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("loggedOut")
  );
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    async function initializeLogin() {
      try {
        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
          if (!hasLoggedOut) {
            liff.login();
          }
          return;
        }

        const accessToken = liff.getAccessToken();
        if (!accessToken) {
          console.error("LINE access token is unavailable");
          return;
        }

        const response = await fetch("/api/auth/line", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });

        if (!response.ok) {
          console.error("Login API failed:", await response.json());
          return;
        }

        // A full navigation makes the root Header read the newly-set auth cookie.
        window.location.replace("/productPage");
      } catch (error) {
        console.error("LIFF login failed:", error);
      }
    }

    initializeLogin();
  }, [hasLoggedOut]);

  async function handleLogin() {
    await liff.init({ liffId: LIFF_ID });
    liff.login();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="space-y-4 rounded-2xl bg-white p-8 text-center shadow-xl">
        {hasLoggedOut ? (
          <>
            <h1 className="text-xl font-bold text-gray-800">ออกจากระบบแล้ว</h1>
            <button
              className="rounded-lg bg-green-600 px-5 py-2 font-semibold text-white hover:bg-green-700"
              type="button"
              onClick={handleLogin}
            >
              เข้าสู่ระบบด้วย LINE
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
            <h1 className="text-xl font-bold text-gray-800">กำลังเข้าสู่ระบบด้วย LINE</h1>
            <p className="text-gray-500">กรุณารอสักครู่ ระบบกำลังยืนยันตัวตนของคุณ...</p>
          </>
        )}
      </div>
    </div>
  );
}
