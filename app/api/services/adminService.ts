import { createAdminClient } from "@/app/api/util/supabase/admin";
import { AdminRole, isAdminRole, type AdminData } from "@/app/models/admin";
import type { CreateAdminCredentials } from "@/app/models/adminLogin";
import { apiError, apiSuccess } from "../response";

export const adminFields =
  "id, authId, email, name, avatarUrl, isActive, role, address, tel, thaiId, updatedAt";

export type AdminAuth = {
  supabase: ReturnType<typeof createAdminClient>;
  admin: { id: string; role: AdminRole | null; isActive: boolean };
};

export async function authenticateAdmin(accessToken: string): Promise<AdminAuth | null> {
  const supabase = createAdminClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return null;

  const { data: admin, error } = await supabase
    .from("employees")
    .select("id, role, isActive")
    .eq("authId", authData.user.id)
    .maybeSingle();
  if (error || !admin?.isActive) return null;

  return { supabase, admin: admin as AdminAuth["admin"] };
}

export function isSuperAdmin(auth: AdminAuth) {
  return auth.admin.role === AdminRole.SuperAdmin;
}

export async function getAllAdmins(auth: AdminAuth) {
  if (!isSuperAdmin(auth)) return apiError("Only a super admin can view all admins");
  const { data, error } = await auth.supabase.from("employees").select(adminFields);
  if (error) return apiError("Failed to fetch admins");
  return apiSuccess("Admins retrieved successfully", data as AdminData[]);
}

export async function createAdmin(auth: AdminAuth, input: CreateAdminCredentials) {
  if (!isSuperAdmin(auth)) return apiError("Only a super admin can add admins");
  if (!input.email.trim() || input.password.length < 6 || !isAdminRole(input.role)) {
    return apiError("Invalid admin credentials");
  }

  const { data: userData, error: userError } = await auth.supabase.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: input.email_confirm === true,
  });
  if (userError) return apiError("Failed to add admin");

  const { data: employee, error } = await auth.supabase
    .from("employees")
    .insert({
      authId: userData.user.id,
      email: input.email.trim(),
      name: input.name?.trim() || null,
      role: input.role,
      isActive: input.isActive,
      updatedAt: new Date().toISOString(),
    })
    .select(adminFields)
    .single();

  if (error) {
    await auth.supabase.auth.admin.deleteUser(userData.user.id);
    return apiError("Failed to create employee profile");
  }
  return apiSuccess("Admin created successfully", { user: userData.user, employee });
}

export async function getAdminById(auth: AdminAuth, id: string) {
  if (!isSuperAdmin(auth) && auth.admin.id !== id) return apiError("You can only view your own account");
  const { data, error } = await auth.supabase.from("employees").select(adminFields).eq("id", id).maybeSingle();
  if (error || !data) return apiError("Admin not found");
  return apiSuccess("Admin retrieved successfully", data as AdminData);
}

export async function updateAdmin(auth: AdminAuth, id: string, input: Record<string, unknown>) {
  const superAdmin = isSuperAdmin(auth);
  if (!superAdmin && auth.admin.id !== id) return apiError("You can only edit your own account");

  const values: Record<string, unknown> = {};
  for (const field of ["name", "avatarUrl", "address", "tel", "thaiId"]) {
    if (field in input) {
      if (input[field] !== null && typeof input[field] !== "string") return apiError(`Invalid ${field}`);
      values[field] = typeof input[field] === "string" ? input[field].trim() || null : null;
    }
  }

  if (superAdmin) {
    if ("role" in input) {
      if (!isAdminRole(input.role)) return apiError("Invalid admin role");
      values.role = input.role;
    }
    if ("isActive" in input) {
      if (typeof input.isActive !== "boolean") return apiError("Invalid active status");
      values.isActive = input.isActive;
    }
  } else if ("role" in input || "isActive" in input) {
    return apiError("You cannot change your own role or active status");
  }

  if (Object.keys(values).length === 0) return apiError("No editable fields supplied");
  values.updatedAt = new Date().toISOString();
  const { data, error } = await auth.supabase.from("employees").update(values).eq("id", id).select(adminFields).single();
  if (error) return apiError("Failed to update admin");
  return apiSuccess("Admin updated successfully", data as AdminData);
}

export async function deleteAdmin(auth: AdminAuth, id: string) {
  if (!isSuperAdmin(auth)) return apiError("Only a super admin can delete admins");
  if (auth.admin.id === id) return apiError("You cannot delete your own account");
  const { data, error } = await auth.supabase
    .from("employees")
    .update({ isActive: false, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("id, isActive, updatedAt")
    .single();
  if (error) return apiError("Failed to deactivate admin");
  return apiSuccess("Admin deactivated successfully", data);
}
