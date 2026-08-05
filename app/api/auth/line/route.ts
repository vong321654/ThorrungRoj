import { NextResponse } from "next/server";
import { findOrCreateUserFromLineProfile } from "@/app/api/services/userService";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    const { accessToken } = await req.json();
    const lineClientId = process.env.LINE_CLIENT_ID;

    if (typeof accessToken !== "string" || !accessToken) {
      return NextResponse.json({ error: "No token" }, { status: 400 });
    }
    if (!lineClientId) {
      console.error("LINE LOGIN ERROR: LINE_CLIENT_ID is not configured");
      return NextResponse.json({ error: "LINE login is not configured" }, { status: 500 });
    }

    // Verify the access token and make sure it belongs to this LINE Login channel.
    const verifyUrl = new URL("https://api.line.me/oauth2/v2.1/verify");
    verifyUrl.searchParams.set("access_token", accessToken);
    const verifyRes = await fetch(verifyUrl, { cache: "no-store" });

    const verifyData = await verifyRes.json();

    if (
      !verifyRes.ok ||
      verifyData.client_id !== lineClientId ||
      typeof verifyData.expires_in !== "number" ||
      verifyData.expires_in <= 0
    ) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Retrieve trusted profile data from LINE instead of accepting it from the browser.
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!profileRes.ok) {
      return NextResponse.json({ error: "Unable to retrieve LINE profile" }, { status: 401 });
    }

    const profile = await profileRes.json();
    const lineUserId = profile.userId;

    if (typeof lineUserId !== "string" || !lineUserId) {
      return NextResponse.json({ error: "Invalid LINE profile" }, { status: 401 });
    }

    const user = await findOrCreateUserFromLineProfile(profile);

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
