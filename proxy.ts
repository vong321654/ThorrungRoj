import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionResponse } from "@/app/api/util/supabase/middleware";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  try {
    const { response, user } = await getSessionResponse(request);
    if (user) return response;
  } catch {
    // A failed session check must not expose an admin page.
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*"],
};
