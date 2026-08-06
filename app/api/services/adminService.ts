import { createClient } from "../util/supabase/client";
import type { UpdateAdminInput } from "../../models/admin";
import type {
  AdminLoginCredentials,
  CreateAdminCredentials,
} from "../../models/adminLogin";
const supabase = createClient();

export async function signInWithEmail(admin: AdminLoginCredentials) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: admin.email,
    password: admin.password,
  });
  if (error) {
    console.error("SIGN IN ERROR:", error.message);
    throw new Error("Failed to sign in");
  }

  console.log("SIGN IN DATA:", data);
  return {
    status: "success",
    message: "Signed in successfully",
    data,
  };
}

export async function addAdmin(admin: CreateAdminCredentials) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: admin.email,
    password: admin.password,
    email_confirm: admin.email_confirm,
  });
  if (error) {
    throw new Error("Failed to add admin");
  }
  return {
    status: "success",
    message: "Admin created successfully",
    data,
  };
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
    return {
      status: "error",
      message: "Failed to update admin",
      error: error,
    };
  }
  return {
    status: "success",
    message: "Admin updated successfully",
    data: data,
  };
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
    return {
      status: "error" as const,
      message: "Admin not found",
      data: null,
    };
  }

  return {
    status: "success" as const,
    message: "Admin retrieved successfully",
    data,
  };
}

export async function getCurrentAdmin() {
  const { data: authData, error } = await supabase.auth.getUser();
  if (error) {
    return {
      status: "error",
      message: "Failed to get current admin",
      error: error,
    };
  }
  const { data, error: adminError } = await supabase
    .from("employees")
    .select(
      "id, email, name, avatarUrl, isActive, role, address, tel, thaiId, updatedAt",
    )
    .eq("authId", authData.user?.id)
    .single();
  if (adminError) {
    return {
      status: "error",
      message: "Admin not found",
      error: adminError,
    };
  }
  return {
    status: "success",
    message: "Current admin retrieved successfully",
    data,
  };
}

export async function getAllAdmins() {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .neq("role", "superAdmin");
  if (error) {
    return {
      status: "error",
      message: "Failed to get all admins",
      error: error,
    };
  }
  return {
    status: "success",
    message: "All admins retrieved successfully",
    data,
  };
}
export async function deleteAdminById(id: string) {
  const { data, error } = await supabase
    .from("employees")
    .update({ isActive: false, updatedAt: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return {
      status: "error",
      message: "Failed to delete admin",
      error: error,
    };
  }
  return {
    status: "success",
    message: "Admin deleted successfully",
     data,
  };
}
export async function getAdminByThaiID(thaiId: string) {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .ilike("thaiId", `%${thaiId}%`);
  if (error) {
    return {
      status: "error",
      message: "Failed to get admin by Thai ID",
      error: error,
    };
  }
  return {
    status: "success",
    message: "Admin retrieved successfully",
     data,
  };
}

export async function signOut() {
  supabase.auth.signOut({ scope: "local" });
  location.pathname = "/admin/login";
  return;
}
