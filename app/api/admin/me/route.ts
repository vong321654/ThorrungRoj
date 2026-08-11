import { createAdminClient } from "@/app/api/util/supabase/admin";
import { apiError, apiSuccess } from "@/app/api/response";
import type { AdminData } from "@/app/models/admin";
import { headers } from "next/headers";

export async function GET() {
  const authorization = (await headers()).get("authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return Response.json(
      apiError("Missing access token"),
      { status: 401 },
    );
  }

  const supabase = createAdminClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return Response.json(
      apiError("Invalid session"),
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
      apiError("Failed to get admin data"),
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json(
      apiError("Employee profile was not found"),
      { status: 403 },
    );
  }

  if (!data.isActive) {
    return Response.json(
      apiError("Employee account is inactive"),
      { status: 403 },
    );
  }

  return Response.json(
    apiSuccess(
      "Admin data retrieved successfully",
      data as AdminData,
    ),
  );
}
