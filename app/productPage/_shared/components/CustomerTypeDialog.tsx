"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { CUSTOMERTYPE } from "@/app/enums/customer";
import type { APIRESULT } from "@/app/models/api";
import type { CURRENTUSER } from "@/app/models/user";
import { PRIVACY_POLICY_VERSION } from "@/app/privacy/policyVersion";
import { getCustomerAccessToken, useCustomerProfile } from "../CustomerProfileContext";

const OPTIONS: Array<{ value: CUSTOMERTYPE; label: string; hint: string }> = [
  { value: CUSTOMERTYPE.INDIVIDUAL, label: "บ้านทั่วไป", hint: "ใช้แก๊สในบ้าน ใช้ราคาปกติ" },
  {
    value: CUSTOMERTYPE.SHOP,
    label: "ร้านค้า",
    hint: "ร้านอาหารหรือกิจการ ได้ราคาร้านค้าสำหรับเปลี่ยนถังและฝากเติม หลังร้านตรวจสอบและยืนยันบัญชี",
  },
];

/**
 * ขึ้นต่อจาก pop-up นโยบาย ให้ลูกค้าเลือกประเภทครั้งเดียว ปิดเองไม่ได้จนกว่าจะเลือก
 * เลือกแล้วเปลี่ยนเองไม่ได้ ต้องให้แอดมินแก้ เพื่อไม่ให้สลับไปมาเพื่อเลือกราคาที่ถูกกว่า
 */
export default function CustomerTypeDialog() {
  const { profile, updateProfile, reload } = useCustomerProfile();
  const [selected, setSelected] = useState<CUSTOMERTYPE | "">("");
  const [shopName, setShopName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ข้อความหลังส่งคำขอเป็นร้านค้า ให้ลูกค้ากดรับทราบก่อนปิด
  const [isShopRequestSent, setIsShopRequestSent] = useState(false);

  const needsChoice =
    !!profile && profile.privacyPolicyVersion === PRIVACY_POLICY_VERSION && !profile.customerTypeChosenAt;
  const open = needsChoice || isShopRequestSent;
  const isShop = selected === CUSTOMERTYPE.SHOP;
  const canSubmit = selected !== "" && (!isShop || shopName.trim().length > 0) && !isSaving;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSaving(true);
    setError(null);

    try {
      const accessToken = await getCustomerAccessToken();
      if (!accessToken) throw new Error("กรุณาเข้าสู่ระบบใหม่อีกครั้ง");

      const response = await fetch("/api/users/me/customer-type", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ customerType: selected, ...(isShop ? { shopName: shopName.trim() } : {}) }),
      });
      const result = (await response.json().catch(() => null)) as APIRESULT<CURRENTUSER | null> | null;

      if (response.status === 409) {
        // เลือกไว้แล้วจากอีกหน้าจอ โหลดโปรไฟล์ล่าสุดแทนการให้เลือกซ้ำ
        await reload();
        return;
      }
      if (!response.ok || !result || result.status === "error" || !result.results) {
        throw new Error(result?.message || "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
      }

      // บัญชีที่แอดมินตั้งเป็นร้านค้าไว้แล้วจะได้ approved ทันที ไม่ต้องแจ้งว่ารอตรวจสอบ
      if (result.results.shopRequestStatus === "pending") setIsShopRequestSent(true);
      updateProfile(result.results);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} fullWidth maxWidth="xs" aria-labelledby="customerTypeTitle">
      <DialogTitle id="customerTypeTitle" sx={{ fontWeight: 700 }}>
        {isShopRequestSent ? "ส่งคำขอเรียบร้อย" : "คุณสั่งแก๊สในนามของ?"}
      </DialogTitle>
      <DialogContent dividers>
        {isShopRequestSent ? (
          <Typography>
            ร้านได้รับคำขอบัญชีร้านค้าแล้ว ระหว่างรอร้านตรวจสอบ ราคาที่แสดงจะเป็นราคาบ้านทั่วไป
            เมื่อร้านยืนยันแล้วจะเห็นราคาร้านค้าโดยอัตโนมัติ
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              เลือกได้ครั้งเดียว หากต้องการเปลี่ยนภายหลังกรุณาติดต่อร้าน
            </Typography>
            <RadioGroup value={selected} onChange={(event) => setSelected(event.target.value as CUSTOMERTYPE)}>
              {OPTIONS.map((option) => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  disabled={isSaving}
                  label={
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>{option.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.hint}
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", mb: 1, mr: 0 }}
                />
              ))}
            </RadioGroup>
            {isShop && (
              <TextField
                label="ชื่อร้าน"
                value={shopName}
                onChange={(event) => setShopName(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 100 } }}
                disabled={isSaving}
                required
                fullWidth
                sx={{ mt: 1 }}
              />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ flexDirection: "column", alignItems: "stretch", gap: 1, p: 2 }}>
        {error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}
        {isShopRequestSent ? (
          <Button
            variant="contained"
            color="error"
            size="large"
            fullWidth
            onClick={() => setIsShopRequestSent(false)}
            sx={{ fontWeight: 700, ml: "0 !important" }}
          >
            ตกลง
          </Button>
        ) : (
          <Button
            variant="contained"
            color="error"
            size="large"
            fullWidth
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            sx={{ fontWeight: 700, ml: "0 !important" }}
          >
            {isSaving ? "กำลังบันทึก..." : "ยืนยัน"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
