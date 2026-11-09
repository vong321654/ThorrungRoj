import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/app/api/util/supabase/server";
import { syncUserFromSupabaseLineAuth } from "@/app/api/services/userService";
import { apiError } from "@/app/api/response";
import {
  DEFAULT_AFTER_LOGIN_PATH,
  getSafeNextPath,
  LOGIN_NEXT_COOKIE,
} from "@/app/util/loginRedirect";

function readNextPath(rawValue: string | undefined): string | null {
  if (!rawValue) return null;
  try {
    return getSafeNextPath(decodeURIComponent(rawValue));
  } catch {
    return null;
  }
}

// cookie ปลายทางใช้ได้ครั้งเดียว ลบทิ้งทุกครั้งที่ callback ทำงาน
function redirectAndClearNext(url: URL) {
  const response = NextResponse.redirect(url);
  response.cookies.delete(LOGIN_NEXT_COOKIE);
  return response;
}

// login ไม่สำเร็จแล้วกลับไปหน้า login พร้อมปลายทางเดิม ลูกค้ากดลองใหม่แล้วยังกลับมาหน้าเดิมได้
function loginErrorUrl(request: Request, error: string, nextPath: string | null) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  if (nextPath) loginUrl.searchParams.set("next", nextPath);
  return loginUrl;
}

/**
 * Supabase Auth Custom OAuth callback for LINE.
 * The session is stored in SSR cookies before redirecting to the page the
 * customer started from (or the product page by default).
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");
  const authErrorDescription = requestUrl.searchParams.get("error_description");

  const cookieStore = await cookies();
  const nextPath = readNextPath(cookieStore.get(LOGIN_NEXT_COOKIE)?.value);

  if (authError) {
    return redirectAndClearNext(loginErrorUrl(request, authErrorDescription || authError, nextPath));
  }

  if (code) {
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const syncResult = await syncUserFromSupabaseLineAuth(user);
        if (syncResult.status === "success") {
          return redirectAndClearNext(new URL(nextPath ?? DEFAULT_AFTER_LOGIN_PATH, request.url));
        }
      }
    }
  }

  return redirectAndClearNext(loginErrorUrl(request, "auth", nextPath));
}

/**
 * Legacy LIFF/JWT login is intentionally disabled.
 * LINE login now uses the GET OAuth callback above.
 */
export async function POST() {
  return NextResponse.json(
    apiError("Legacy LINE login is disabled; use Supabase OAuth"),
    { status: 410 },
  );
}
