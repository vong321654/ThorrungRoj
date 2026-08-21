import type { UPDATEUSERPAYLOAD } from "@/app/models/user";

export type EditUserValidationErrors = Partial<
  Record<keyof UPDATEUSERPAYLOAD, string>
>;

export const ALLOWED_EMAIL_DOMAINS = [
  "hotmail.com",
  "hotmail.co.th",
  "gmail.com",
  "gmail.co.th",
  "yohoo.com",
  "yohoo.co.th",
  "outlook.com",
  "outllok.co.th",
] as const;

export function validateEditUserPayload(
  payload: UPDATEUSERPAYLOAD,
): EditUserValidationErrors {
  const errors: EditUserValidationErrors = {};
  const name = payload.name?.trim() || "";
  const email = payload.email?.trim() || "";
  const phone = payload.phone?.trim() || "";
  const address = payload.address?.trim() || "";

  if (!name) {
    errors.name = "กรุณากรอกชื่อผู้ใช้";
  } else if (name.length > 100) {
    errors.name = "ชื่อต้องไม่เกิน 100 ตัวอักษร";
  }

  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "รูปแบบอีเมลไม่ถูกต้อง เช่น name@gmail.com";
    } else if (email.length > 255) {
      errors.email = "อีเมลต้องไม่เกิน 255 ตัวอักษร";
    } else {
      const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();

      if (!ALLOWED_EMAIL_DOMAINS.some((allowed) => allowed === domain)) {
        errors.email = `รองรับเฉพาะ ${ALLOWED_EMAIL_DOMAINS.join(", ")}`;
      }
    }
  }

  if (phone) {
    const normalizedPhone = phone.replace(/[\s-]/g, "");
    if (!/^(?:\+66\d{8,9}|0\d{8,9})$/.test(normalizedPhone)) {
      errors.phone = "กรุณากรอกเบอร์โทรศัพท์ไทย 9-10 หลัก";
    }
  }

  if (address.length > 500) {
    errors.address = "ที่อยู่ต้องไม่เกิน 500 ตัวอักษร";
  }

  return errors;
}
