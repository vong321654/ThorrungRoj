"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import type { Theme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import PrivacyPolicyContent from "@/app/privacy/PrivacyPolicyContent";
import { PRIVACY_POLICY_VERSION } from "@/app/privacy/policyVersion";
import { getCustomerAccessToken, useCustomerProfile } from "../CustomerProfileContext";

/**
 * แสดงหลังลูกค้าเข้าสู่ระบบด้วย LINE จนกว่าจะรับทราบนโยบายฉบับปัจจุบัน
 * ไม่ส่ง onClose ให้ Dialog เพื่อไม่ให้ปิดด้วยการแตะพื้นหลังหรือกด Esc โดยไม่ได้รับทราบ
 * ผู้ที่ไม่ได้เข้าสู่ระบบและพนักงานไม่มีแถวใน users จึงไม่เห็น pop-up นี้
 */
export default function PrivacyPolicyDialog() {
  const { profile, updateProfile } = useCustomerProfile();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPhone = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"), { noSsr: true });
  const open = !!profile && profile.privacyPolicyVersion !== PRIVACY_POLICY_VERSION;

  async function handleAcknowledge() {
    setIsSaving(true);
    setError(null);

    try {
      const accessToken = await getCustomerAccessToken();
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

      // อัปเดตโปรไฟล์ในหน้า เพื่อให้ pop-up เลือกประเภทลูกค้าขึ้นต่อทันที
      updateProfile({ privacyPolicyVersion: PRIVACY_POLICY_VERSION });
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} scroll="paper" fullWidth fullScreen={isPhone} maxWidth="sm" aria-labelledby="privacyPolicyTitle">
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
