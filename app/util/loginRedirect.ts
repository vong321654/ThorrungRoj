// path ที่จะพาลูกค้ากลับไปหลัง LINE login สำเร็จ
// เก็บใน cookie แทนการต่อ query ใน redirectTo ของ OAuth เพราะ Supabase เทียบ redirectTo กับ allowlist
// ถ้ามี query ต่อท้ายอาจไม่ตรงแล้วถูกส่งไป Site URL แทน
export const LOGIN_NEXT_COOKIE = "loginNext";
export const LOGIN_NEXT_MAX_AGE_SECONDS = 600;
export const DEFAULT_AFTER_LOGIN_PATH = "/productPage";

// รับเฉพาะหน้าลูกค้าภายในเว็บ กัน open redirect เช่น //evil.com หรือ /\evil.com และกันพาไปหน้าแอดมิน
const ALLOWED_PREFIXES = ["/productPage", "/manageUser"];

export function getSafeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;

  let url: URL;
  try {
    url = new URL(value, "http://localhost");
  } catch {
    return null;
  }
  if (url.origin !== "http://localhost") return null;

  const isAllowed = ALLOWED_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  );
  return isAllowed ? `${url.pathname}${url.search}` : null;
}

export function loginUrlWithNext(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}
