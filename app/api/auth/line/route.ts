import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    const { idToken, profile } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "No token" }, { status: 400 });
    }

    // 🔐 Verify token กับ LINE
    const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: process.env.LINE_CLIENT_ID!,
      }),
    });

    const verifyData = await verifyRes.json();

    if (verifyData.error) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const lineUserId = verifyData.sub;

    // 💾 จัดการข้อมูลผู้ใช้ด้วย Supabase
    const supabase = createAdminClient();

    // 🔍 ตรวจสอบว่ามีผู้ใช้รายนี้อยู่แล้วหรือไม่ (เพื่อทำตามเงื่อนไข Skip if exists)
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("lineUserId", lineUserId)
      .maybeSingle();

    let user = existingUser;

    if (fetchError) {
      console.error("FETCH USER ERROR:", fetchError.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // ✨ ถ้ายังไม่มีผู้ใช้ ให้บันทึกข้อมูลใหม่
    if (!user) {
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          lineUserId,
          name: profile.displayName,
          avatarUrl: profile.pictureUrl,
          email: verifyData.email || null,
          isActive: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error("INSERT USER ERROR:", insertError.message);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
      user = newUser;
      console.log("NEW USER CREATED:", user);
    } else {
      console.log("EXISTING USER LOGGED IN (SKIPPED UPDATE):", user);
    }

    // 🔐 สร้าง JWT
    const token = jwt.sign(
      {
        userId: user.id,
        lineUserId: user.lineUserId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    // 🍪 SET COOKIE และส่ง Response
    const response = NextResponse.json({ message: "Login success", user });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;

  } catch (err) {
    console.error("LINE LOGIN ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
