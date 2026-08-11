import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionResponse } from "@/app/api/util/supabase/middleware";
import { createAdminClient } from "@/app/api/util/supabase/admin";

export async function proxy(request: NextRequest) {
  try {
    const { response, user, signOut } = await getSessionResponse(request);
    const isLoginPage = request.nextUrl.pathname === "/admin/login";

    if (!user) {
      if (isLoginPage) return response;
      return NextResponse.redirect(new URL("/401", request.url));
    }

    const { data: employee, error } = await createAdminClient()
      .from("employees")
      .select("id, isActive")
      .eq("authId", user.id)
      .maybeSingle();

    if (!error && employee?.isActive === true) return response;

    const isLineSession = user.identities?.some(
      (identity) => identity.provider === "custom:line-liff",
    ) === true;
    if (isLoginPage && isLineSession) {
      const clearedResponse = await signOut();
      const loginResponse = NextResponse.next();
      clearedResponse.cookies.getAll().forEach(({ name, value }) => {
        loginResponse.cookies.set(name, value, { path: "/", maxAge: 0 });
      });
      return loginResponse;
    }

    return NextResponse.redirect(new URL("/401", request.url));
  } catch {
    // A failed session check must not expose an admin page.
  }

  return NextResponse.redirect(new URL("/401", request.url));
}

export const config = {
  matcher: ["/admin/:path*"],
};
