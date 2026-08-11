import { NextResponse } from "next/server";
import { apiSuccess } from "@/app/api/response";
import { cookies } from "next/headers";
import { createClient } from "@/app/api/util/supabase/server";

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  await supabase.auth.signOut();

  const response = NextResponse.json(apiSuccess("Logout successful", null));

  // ล้าง cookie จากระบบ custom JWT เดิมระหว่างช่วงเปลี่ยนระบบ
  response.cookies.set("token", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
