import { apiError, apiSuccess } from "@/app/api/response";
import { AdminRole } from "@/app/models/admin";
import { authenticateAdmin } from "../authorization";

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const { data, error } = await auth.supabase
    .from("users")
    .select("id, name, phone, email, address, contactName, shopName, customerType, isActive, createdAt")
    .order("createdAt", { ascending: false });

  if (error) return Response.json(apiError("Failed to fetch users"), { status: 500 });
  return Response.json(apiSuccess("Users retrieved successfully", data ?? []));
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (auth.admin.role !== AdminRole.SuperAdmin) {
    return Response.json(apiError("Only a super admin can edit users"), { status: 403 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") {
    return Response.json(apiError("Invalid user update"), { status: 400 });
  }

  const values: Record<string, string | boolean | null> = {};
  for (const field of ["phone", "email", "address", "contactName", "shopName"] as const) {
    if (field in body) {
      if (body[field] !== null && typeof body[field] !== "string") {
        return Response.json(apiError(`Invalid ${field}`), { status: 400 });
      }
      values[field] = typeof body[field] === "string" ? body[field].trim() || null : null;
    }
  }
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return Response.json(apiError("A name is required"), { status: 400 });
    }
    values.name = body.name.trim();
  }
  if ("customerType" in body) {
    if (body.customerType !== "individual" && body.customerType !== "shop") {
      return Response.json(apiError("Invalid customer type"), { status: 400 });
    }
    values.customerType = body.customerType;
  }
  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") return Response.json(apiError("Invalid active status"), { status: 400 });
    values.isActive = body.isActive;
  }
  if (Object.keys(values).length === 0) {
    return Response.json(apiError("No editable fields supplied"), { status: 400 });
  }

  values.updatedAt = new Date().toISOString();
  const { data, error } = await auth.supabase
    .from("users")
    .update(values)
    .eq("id", body.id)
    .select("id, name, phone, email, address, contactName, shopName, customerType, isActive, createdAt")
    .maybeSingle();

  if (error) return Response.json(apiError("Failed to update user"), { status: 500 });
  if (!data) return Response.json(apiError("User not found"), { status: 404 });
  return Response.json(apiSuccess("User updated successfully", data));
}
