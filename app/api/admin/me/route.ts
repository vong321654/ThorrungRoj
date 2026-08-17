import { apiError, apiSuccess } from "@/app/api/response";
import type { AdminData } from "@/app/models/admin";
import { authenticateAdmin } from "../authorization";

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const { data, error } = await auth.adminSupabase
    .from("employees")
    .select("id, email, name, avatarUrl, isActive, role, address, tel, thaiId, updatedAt")
    .eq("id", auth.admin.id)
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
