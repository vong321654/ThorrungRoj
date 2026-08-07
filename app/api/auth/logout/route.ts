import { NextResponse } from "next/server";
import { apiSuccess } from "@/app/api/response";

export async function POST() {
  const response = NextResponse.json(apiSuccess("Logout successful", null));

  response.cookies.set("token", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
