import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/app/api/util/supabase/client";

/**
 * access token ของลูกค้าที่ server ยืนยันแล้วว่ายังใช้ได้ ถ้ายังไม่ได้ login หรือ session ใช้ไม่ได้ จะได้ null
 *
 * ห้ามเช็คแค่ getSession() เพราะอ่าน cookie ในเครื่องอย่างเดียว ไม่ถาม server
 * ถ้ามี session เก่าค้าง (บัญชีถูกลบ, ถูก sign out จากที่อื่น, refresh token ใช้ไม่ได้)
 * หน้าเว็บจะคิดว่า login อยู่แล้วพาไป checkout แทนหน้า LINE login แล้วไปพังตอนกดสั่ง
 * session ที่ server ไม่รับจะถูกล้างออกจากเครื่องด้วย การ login ครั้งถัดไปจะได้เริ่มใหม่
 */
export async function getVerifiedAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;

  const { data: userData, error } = await supabase.auth.getUser();
  if (userData.user) {
    // getUser() อาจ refresh token ให้ระหว่างทาง จึงอ่าน session ใหม่อีกรอบ
    const { data: fresh } = await supabase.auth.getSession();
    return fresh.session?.access_token ?? data.session.access_token;
  }

  // เน็ตหลุดหรือ auth server ไม่ตอบ: ยังไม่รู้ว่า session ใช้ได้ไหม ไม่ล้างทิ้ง ให้ API เป็นคนตอบแทน
  if (error && isAuthRetryableFetchError(error)) return data.session.access_token;

  await clearStaleSession();
  return null;
}

/** ล้าง session ในเครื่องหลัง API ตอบ 401 (server ไม่รับ token นี้แล้ว) */
export async function clearStaleSession() {
  await createClient().auth.signOut({ scope: "local" });
}
