"use client";

import { useEffect, useRef } from "react";

// 15 วินาทีพอให้เห็นออเดอร์ใหม่เร็ว โดยไม่ยิง API ถี่เกินไป
export const AUTO_REFRESH_MS = 15_000;

/**
 * เรียก refresh ซ้ำทุก intervalMs เฉพาะตอนแท็บเปิดอยู่ และเรียกทันทีเมื่อกลับมาที่แท็บ
 * (แท็บที่ซ่อนอยู่เบราว์เซอร์จะหน่วง timer อยู่แล้ว หยุดไปเลยจะได้ไม่เปลือง)
 * ไม่ยิงซ้อนถ้ารอบก่อนยังไม่เสร็จ
 */
export function useAutoRefresh(refresh: () => Promise<void>, enabled: boolean, intervalMs = AUTO_REFRESH_MS) {
  const refreshRef = useRef(refresh);
  const inFlightRef = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function run() {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await refreshRef.current();
      } finally {
        inFlightRef.current = false;
      }
    }

    function start() {
      if (timer === null) timer = setInterval(() => void run(), intervalMs);
    }

    function stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void run();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs]);
}
