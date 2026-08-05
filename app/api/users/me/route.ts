import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import jwt, { type JwtPayload } from "jsonwebtoken";

type UpdateProfileBody = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  address?: unknown;
};

type ProfileUpdate = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  updatedAt: string;
};

const editableFields = ["name", "phone", "email", "address"] as const;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nullableText(value: unknown, fieldName: string, maxLength: number) {
  if (value === null) return { value: null };

  if (typeof value !== "string") {
    return { error: `${fieldName} must be a string or null` };
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return { error: `${fieldName} must not exceed ${maxLength} characters` };
  }

  return { value: trimmed || null };
}

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token || !jwtSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let lineUserId: string | undefined;
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload !== "string" && "lineUserId" in payload) {
      lineUserId = (payload as JwtPayload & { lineUserId?: string }).lineUserId;
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!lineUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UpdateProfileBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const providedFields = editableFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field),
  );
  if (providedFields.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one field: name, phone, email, or address" },
      { status: 400 },
    );
  }

  const update: ProfileUpdate = { updatedAt: new Date().toISOString() };
  for (const field of providedFields) {
    const result = nullableText(
      body[field],
      field,
      field === "address" ? 500 : field === "name" ? 100 : 255,
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (field === "email" && result.value && !emailPattern.test(result.value)) {
      return NextResponse.json({ error: "email is invalid" }, { status: 400 });
    }

    update[field] = result.value;
  }

  try {
    const supabase = createAdminClient();
    const { data: currentUser, error: fetchError } = await supabase
      .from("users")
      .select("id, isActive")
      .eq("lineUserId", lineUserId)
      .maybeSingle();

    if (fetchError) {
      console.error("FETCH USER ERROR:", fetchError.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!currentUser.isActive) {
      return NextResponse.json({ error: "User account is inactive" }, { status: 403 });
    }

    const { data: user, error: updateError } = await supabase
      .from("users")
      .update(update)
      .eq("lineUserId", lineUserId)
      .select("id, lineUserId, name, phone, email, address, avatarUrl, isActive, createdAt, updatedAt")
      .single();

    if (updateError) {
      console.error("UPDATE PROFILE ERROR:", updateError.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ message: "Profile updated", user });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
