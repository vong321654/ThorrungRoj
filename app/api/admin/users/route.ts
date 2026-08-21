import { apiError, apiSuccess } from "@/app/api/response";
import { ADMINROLE } from "@/app/models/admin";
import type { ADMINUSERUPDATEPAYLOAD, ADMINUSERUPDATEVALUES } from "@/app/models/user";
import { authenticateAdmin } from "../authorization";
import { isAdminOrSuperAdmin } from "@/app/api/services/adminService";

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdminOrSuperAdmin(auth)) return Response.json(apiError("Only admins can view users"), { status: 403 });

  const { data, error } = await auth.adminSupabase
    .from("users")
    .select("id, name, phone, email, address, contactName, shopName, customerType, isActive, createdAt")
    .order("createdAt", { ascending: false });

  if (error) return Response.json(apiError("Failed to fetch users"), { status: 500 });
  return Response.json(apiSuccess("Users retrieved successfully", data ?? []));
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (auth.admin.role !== ADMINROLE.SUPER_ADMIN) {
    return Response.json(apiError("Only a super admin can edit users"), { status: 403 });
  }

  const body = await request.json().catch(() => null) as ADMINUSERUPDATEPAYLOAD | null;
  if (!body || typeof body.id !== "string") {
    return Response.json(apiError("Invalid user update"), { status: 400 });
  }

  const values: ADMINUSERUPDATEVALUES = {};
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
  const { data, error } = await auth.adminSupabase
    .from("users")
    .update(values)
    .eq("id", body.id)
    .select("id, name, phone, email, address, contactName, shopName, customerType, isActive, createdAt")
    .maybeSingle();

  if (error) return Response.json(apiError("Failed to update user"), { status: 500 });
  if (!data) return Response.json(apiError("User not found"), { status: 404 });
  return Response.json(apiSuccess("User updated successfully", data));
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (auth.admin.role !== ADMINROLE.SUPER_ADMIN) {
    return Response.json(apiError("Only a super admin can delete users"), { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id?.trim()) return Response.json(apiError("User id is required"), { status: 400 });

  // Keep customer history (orders, payments, and debts) intact while preventing
  // the account from being used again.
  const { data, error } = await auth.adminSupabase
    .from("users")
    .update({ isActive: false, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, phone, email, address, contactName, shopName, customerType, isActive, createdAt")
    .maybeSingle();

  if (error) return Response.json(apiError("Failed to delete user"), { status: 500 });
  if (!data) return Response.json(apiError("User not found"), { status: 404 });
  return Response.json(apiSuccess("User deactivated successfully", data));
}
