import { createAdminClient } from "@/app/api/util/supabase/admin";
import type { AdminData } from "@/app/models/admin";
import { headers } from "next/headers";

export async function GET() {
  const authorization = (await headers()).get("authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return Response.json(
      { status: "error", message: "Missing access token", data: null },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return Response.json(
      { status: "error", message: "Invalid session", data: null },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("employees")
    .select("id, email, name, avatarUrl, isActive, role, address, tel, thaiId, updatedAt")
    .eq("authId", authData.user.id)
    .maybeSingle();

  if (error) {
    return Response.json(
      { status: "error", message: "Failed to get admin data", data: null },
      { status: 500 },
    );
  }

  const adminData: AdminData = data ?? {
    id: authData.user.id,
    email: authData.user.email ?? null,
    name: null,
    avatarUrl: null,
    isActive: true,
    role: null,
    address: null,
    tel: null,
    thaiId: null,
    updatedAt: authData.user.updated_at ?? null,
  };

  return Response.json({
    status: "success",
    message: data ? "Admin data retrieved successfully" : "No admin profile found",
    data: adminData,
  });
}
