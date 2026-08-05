import type { UpdateUserPayload } from "@/app/models/user";

export type EditUserValidationErrors = Partial<
  Record<keyof UpdateUserPayload, string>
>;

export function validateEditUserPayload(
  payload: UpdateUserPayload,
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

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com";
  } else if (email.length > 255) {
    errors.email = "อีเมลต้องไม่เกิน 255 ตัวอักษร";
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
