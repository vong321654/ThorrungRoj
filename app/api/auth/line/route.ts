import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/app/api/util/supabase/server";
import { syncUserFromSupabaseLineAuth } from "@/app/api/services/userService";
import { apiError } from "@/app/api/response";

/**
 * Supabase Auth Custom OAuth callback for LINE.
 * The session is stored in SSR cookies before redirecting to the product page.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");
  const authErrorDescription = requestUrl.searchParams.get("error_description");

  if (authError) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", authErrorDescription || authError);
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const syncResult = await syncUserFromSupabaseLineAuth(user);
        if (syncResult.status === "success") {
          return NextResponse.redirect(new URL("/productPage", request.url));
        }
      }
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", request.url));
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
