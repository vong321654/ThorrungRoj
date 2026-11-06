import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMINROLE } from "@/app/enums/admin";

export { ADMINROLE };

export function ISADMINROLE(value: unknown): value is ADMINROLE {
  return Object.values(ADMINROLE).includes(value as ADMINROLE);
}

// คอลัมน์ thaiId เก็บได้ทั้งบัตรประชาชนและเลขวีซ่า/พาสปอร์ต ฟอร์มใช้ตัวนี้แยกว่าค่าเดิมเป็นแบบไหน
export function ISTHAIID(value: string) {
  return /^\d{13}$/.test(value);
}

// ใช้ทั้งในฟอร์มและ API ช่องที่เว้นว่างถือว่าผ่าน เพราะข้อมูลเหล่านี้ไม่บังคับกรอก
export function VALIDATEADMINCONTACT(input: {
  address?: string | null;
  tel?: string | null;
  thaiId?: string | null;
}): string | null {
  if (input.tel && !/^(?:\+66\d{8,9}|0\d{8,9})$/.test(input.tel.replace(/[\s-]/g, ""))) {
    return "Phone number must be a valid Thai number";
  }
  // รับทั้งบัตรประชาชนไทย (13 หลัก) และเลขวีซ่า/พาสปอร์ตของลูกจ้างต่างชาติ
  // ต้องเป็นตัวพิมพ์ใหญ่ไม่มีขีด เพื่อให้ UNIQUE ใน DB กันเลขเดียวกันที่พิมพ์คนละแบบได้
  if (input.thaiId && !/^[A-Z0-9]{6,20}$/.test(input.thaiId)) {
    return "ID number must be 6-20 letters or digits, without dashes or spaces";
  }
  if (input.address && input.address.length > 500) {
    return "Address must be 500 characters or fewer";
  }
  return null;
}

export type ADMINDATA = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  role: ADMINROLE;
  createdAt: string;
  updatedAt: string;
  authId: string | null;
  address: string | null;
  tel: string | null;
  thaiId: string | null;
};

export type UPDATEADMININPUT = Partial<
  Pick<
    ADMINDATA,
    "avatarUrl" | "isActive" | "role" | "address" | "tel" | "thaiId"
  >
> & {
  id: string;
  name?: string | null;
};

export type ADMINAUTH = {
  /** Caller-scoped client. Database calls made with this client enforce RLS. */
  supabase: SupabaseClient;
  /** Backward-compatible alias for the caller-scoped client; it never bypasses RLS. */
  adminSupabase: SupabaseClient;
  admin: { id: string; role: ADMINROLE | null; isActive: boolean };
};

export type ADMINAUTHFAILURE = {
  message: string;
  statusCode: 401 | 403 | 500;
};

export type ADMINUPDATEPAYLOAD = Record<string, unknown>;
