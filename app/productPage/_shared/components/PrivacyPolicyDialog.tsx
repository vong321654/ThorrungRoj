"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/models/api";
import type { CURRENTUSER } from "@/app/models/user";
import PrivacyPolicyContent from "@/app/privacy/PrivacyPolicyContent";
import { PRIVACY_POLICY_VERSION } from "@/app/privacy/policyVersion";

async function getAccessToken() {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * แสดงหลังลูกค้าเข้าสู่ระบบด้วย LINE จนกว่าจะรับทราบนโยบายฉบับปัจจุบัน
 * ไม่ส่ง onClose ให้ Dialog เพื่อไม่ให้ปิดด้วยการแตะพื้นหลังหรือกด Esc โดยไม่ได้รับทราบ
 * ผู้ที่ไม่ได้เข้าสู่ระบบและพนักงานไม่มีแถวใน users จึงไม่เห็น pop-up นี้
 */
export default function PrivacyPolicyDialog() {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function checkAcknowledgement() {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;

        const response = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) return;

        const result = (await response.json()) as APIRESULT<CURRENTUSER | null>;
        const user = result.status === "success" ? result.results : null;
        if (!isCancelled && user && user.privacyPolicyVersion !== PRIVACY_POLICY_VERSION) {
          setOpen(true);
        }
      } catch {
        // ตรวจไม่สำเร็จจะถูกตรวจใหม่เมื่อเปิดหน้าครั้งถัดไป และต้องไม่ทำให้หน้าร้านใช้งานไม่ได้
      }
    }

    void checkAcknowledgement();
    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleAcknowledge() {
    setIsSaving(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Missing session");

      const response = await fetch("/api/users/me/privacy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version: PRIVACY_POLICY_VERSION }),
      });

      if (response.status === 409) {
        setError("นโยบายมีการปรับปรุง กรุณาโหลดหน้านี้ใหม่");
        return;
      }
      if (!response.ok) throw new Error("Failed to save");

      setOpen(false);
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} scroll="paper" fullWidth maxWidth="sm" aria-labelledby="privacyPolicyTitle">
      <DialogTitle id="privacyPolicyTitle" sx={{ fontWeight: 700 }}>
        นโยบายความเป็นส่วนตัว
      </DialogTitle>
      <DialogContent dividers>
        <PrivacyPolicyContent />
      </DialogContent>
      <DialogActions sx={{ flexDirection: "column", alignItems: "stretch", gap: 1, p: 2 }}>
        {error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}
        <Button
          variant="contained"
          color="error"
          size="large"
          fullWidth
          disabled={isSaving}
          onClick={handleAcknowledge}
          sx={{ fontWeight: 700, ml: "0 !important" }}
        >
          {isSaving ? "กำลังบันทึก..." : "ตกลง รับทราบนโยบาย"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
