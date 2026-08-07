import { createClient } from "../util/supabase/client";
import {
  AdminRole,
  type AdminData,
  type UpdateAdminInput,
} from "../../models/admin";
import type {
  AdminLoginCredentials,
  CreateAdminCredentials,
} from "../../models/adminLogin";
import type { User } from "@supabase/supabase-js";
import { apiError, apiSuccess, type ApiResult } from "../response";
const supabase = createClient();

export async function signInWithEmail(admin: AdminLoginCredentials) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: admin.email,
    password: admin.password,
  });
  if (error) {
    return apiError("Failed to sign in");
  }

  return apiSuccess("Signed in successfully", data);
}

export async function getAdminSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return apiError("Failed to get admin session");
  }

  return apiSuccess("Admin session retrieved successfully", data.session);
}

export async function addAdmin(admin: CreateAdminCredentials) {
  const sessionResult = await getAdminSession();
  const accessToken = sessionResult.results?.access_token;
  if (sessionResult.status === "error" || !accessToken) {
    return apiError("No active admin session");
  }

  const response = await fetch("/api/admin", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(admin),
  });
  const result = (await response.json().catch(() => null)) as ApiResult<{
    user: User;
    employee: AdminData;
  }> | null;

  if (!response.ok || !result) {
    return apiError("Failed to add admin");
  }

  return result;
}

export async function updateAdmin(admin: UpdateAdminInput) {
  const { data, error } = await supabase
    .from("employees")
    .update({
      name: admin?.name,
      // avatarUrl: admin?.avatarUrl, ต้องเพิ่มการอั้พโหลดรูปภาพก่อนถึงจะสามารถอัปเดต avatarUrl ได้ และดึง url จาก supabase storage มาใส่ใน avatarUrl ได้
      isActive: admin?.isActive,
      role: admin?.role,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", admin.id)
    .select(
      "id, email, name, avatarUrl, isActive, role, address, tel, thaiId, updatedAt",
    )
    .single();
  if (error) {
    return apiError("Failed to update admin");
  }
  return apiSuccess("Admin updated successfully", data);
}

export async function getAdminById(id: string) {
  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, email, name, avatarUrl, isActive, role, address, tel, thaiId, updatedAt",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return apiError("Admin not found");
  }

  return apiSuccess("Admin retrieved successfully", data);
}

export async function getCurrentAdmin() {
  const { data: authData, error } = await supabase.auth.getUser();
  if (error) {
    return apiError("Failed to get current admin");
  }
  const { data, error: adminError } = await supabase
    .from("employees")
    .select(
      "id, email, name, avatarUrl, isActive, role, address, tel, thaiId, updatedAt",
    )
    .eq("authId", authData.user?.id)
    .single();
  if (adminError) {
    return apiError("Admin not found");
  }
  return apiSuccess("Current admin retrieved successfully", data);
}

export async function getAllAdmins() {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .neq("role", AdminRole.SuperAdmin);
  if (error) {
    return apiError("Failed to get all admins");
  }
  return apiSuccess("All admins retrieved successfully", data);
}
export async function deleteAdminById(id: string) {
  const { data, error } = await supabase
    .from("employees")
    .update({ isActive: false, updatedAt: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return apiError("Failed to delete admin");
  }
  return apiSuccess("Admin deleted successfully", data);
}
export async function getAdminByThaiID(thaiId: string) {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .ilike("thaiId", `%${thaiId}%`);
  if (error) {
    return apiError("Failed to get admin by Thai ID");
  }
  return apiSuccess("Admin retrieved successfully", data);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    return apiError("Failed to sign out");
  }

  return apiSuccess("Signed out successfully", null);
}
