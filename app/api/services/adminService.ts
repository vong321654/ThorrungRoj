import { createAdminClient } from "@/app/api/util/supabase/admin";
import { createAuthenticatedClient } from "@/app/api/util/supabase/authenticated";
import {
  ADMINROLE,
  ISADMINROLE,
  VALIDATEADMINCONTACT,
  type ADMINAUTH,
  type ADMINAUTHFAILURE,
  type ADMINDATA,
  type ADMINUPDATEPAYLOAD,
} from "@/app/models/admin";
import type { CREATEADMINCREDENTIALS } from "@/app/models/adminLogin";
import { apiError, apiSuccess } from "../response";

export const adminFields =
  "id, authId, email, name, avatarUrl, isActive, role, address, tel, thaiId, updatedAt";

export type { ADMINAUTH, ADMINAUTHFAILURE } from "@/app/models/admin";

function cleanOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

// thaiId เป็น UNIQUE ใน employees ถ้าซ้ำควรบอกสาเหตุ แทนข้อความบันทึกไม่สำเร็จแบบกว้างๆ
function isDuplicateThaiId(error: { code?: string; message?: string }) {
  return error.code === "23505" && Boolean(error.message?.includes("thaiId"));
}

export async function authenticateAdmin(
  accessToken: string,
): Promise<ADMINAUTH | ADMINAUTHFAILURE> {
  const supabase = createAuthenticatedClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return {
      message: "Invalid or expired Supabase access token",
      statusCode: 401,
    };
  }

  const { data: admin, error } = await supabase
    .from("employees")
    .select("id, role, isActive")
    .eq("authId", authData.user.id)
    .maybeSingle();
  if (error) {
    return { message: "Failed to verify admin account", statusCode: 500 };
  }
  if (!admin) {
    return { message: "Admin profile was not found", statusCode: 403 };
  }
  if (!admin.isActive) {
    return { message: "Admin account is inactive", statusCode: 403 };
  }

  return {
    supabase,
    // Keep existing route/service call sites token-scoped. The service-role
    // client is created locally only for Supabase Auth admin operations.
    adminSupabase: supabase,
    admin: admin as ADMINAUTH["admin"],
  };
}

export function isSuperAdmin(auth: ADMINAUTH) {
  return auth.admin.role === ADMINROLE.SUPER_ADMIN;
}

export function isAdminOrSuperAdmin(auth: ADMINAUTH) {
  return auth.admin.role === ADMINROLE.ADMIN || auth.admin.role === ADMINROLE.SUPER_ADMIN;
}

export async function getAllAdmins(auth: ADMINAUTH) {
  if (!isSuperAdmin(auth)) return apiError("Only a super admin can view all admins");
  const { data, error } = await auth.adminSupabase.from("employees").select(adminFields);
  if (error) return apiError("Failed to fetch admins");
  return apiSuccess("Admins retrieved successfully", data as ADMINDATA[]);
}

export async function createAdmin(auth: ADMINAUTH, input: CREATEADMINCREDENTIALS) {
  if (!isSuperAdmin(auth)) return apiError("Only a super admin can add admins");
  if (!input.email.trim() || input.password.length < 6 || !ISADMINROLE(input.role)) {
    return apiError("Invalid admin credentials");
  }

  // ตรวจก่อนสร้างบัญชีใน Supabase Auth จะได้ไม่ต้องย้อนกลับถ้าข้อมูลไม่ถูกต้อง
  const contact = {
    address: cleanOptionalText(input.address),
    tel: cleanOptionalText(input.tel),
    thaiId: cleanOptionalText(input.thaiId),
  };
  const contactError = VALIDATEADMINCONTACT(contact);
  if (contactError) return apiError(contactError);

  const privilegedAuth = createAdminClient();
  const { data: userData, error: userError } = await privilegedAuth.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: input.email_confirm === true,
  });
  if (userError) {
    return apiError(userError.code === "email_exists" ? "This email is already registered" : "Failed to add admin");
  }

  // trigger sync_employees_after_auth_users_insert ใน DB สร้างแถว employees (id = auth user id)
  // ให้ตั้งแต่ตอน createUser แล้ว จึงต้อง upsert ตาม id เพื่อเติมข้อมูล ถ้า insert จะชน UNIQUE ของ email
  const { data: employee, error } = await auth.supabase
    .from("employees")
    .upsert(
      {
        id: userData.user.id,
        authId: userData.user.id,
        email: input.email.trim(),
        // คอลัมน์ name เป็น NOT NULL แต่ฟอร์มไม่บังคับกรอก
        name: input.name?.trim() || "",
        ...contact,
        role: input.role,
        isActive: input.isActive,
        updatedAt: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select(adminFields)
    .single();

  if (error) {
    // FK employees.authId ไม่มี ON DELETE CASCADE ต้องลบแถว employees ก่อน ไม่งั้นลบ auth user ไม่ได้
    // และอีเมลนี้จะค้างจนสร้างซ้ำไม่ได้อีก
    const { error: profileRollbackError } = await privilegedAuth
      .from("employees")
      .delete()
      .eq("authId", userData.user.id);
    const { error: userRollbackError } = await privilegedAuth.auth.admin.deleteUser(userData.user.id);
    if (profileRollbackError || userRollbackError) {
      return apiError("Failed to create employee profile, and the login account for this email could not be removed");
    }
    return apiError(isDuplicateThaiId(error) ? "This ID number is already in use" : "Failed to create employee profile");
  }
  return apiSuccess("Admin created successfully", { user: userData.user, employee });
}

export async function getAdminById(auth: ADMINAUTH, id: string) {
  if (!isSuperAdmin(auth) && auth.admin.id !== id) return apiError("You can only view your own account");
  const { data, error } = await auth.adminSupabase.from("employees").select(adminFields).eq("id", id).maybeSingle();
  if (error || !data) return apiError("Admin not found");
  return apiSuccess("Admin retrieved successfully", data as ADMINDATA);
}

export async function updateAdmin(auth: ADMINAUTH, id: string, input: ADMINUPDATEPAYLOAD) {
  const superAdmin = isSuperAdmin(auth);
  if (!superAdmin && auth.admin.id !== id) return apiError("You can only edit your own account");

  const values: Record<string, unknown> = {};
  for (const field of ["name", "avatarUrl", "address", "tel", "thaiId"]) {
    if (field in input) {
      if (input[field] !== null && typeof input[field] !== "string") return apiError(`Invalid ${field}`);
      values[field] = typeof input[field] === "string" ? input[field].trim() || null : null;
    }
  }

  const contactError = VALIDATEADMINCONTACT(values as { address?: string | null; tel?: string | null; thaiId?: string | null });
  if (contactError) return apiError(contactError);

  if (superAdmin) {
    if ("role" in input) {
      if (!ISADMINROLE(input.role)) return apiError("Invalid admin role");
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
  const { data, error } = await auth.adminSupabase.from("employees").update(values).eq("id", id).select(adminFields).single();
  if (error) return apiError(isDuplicateThaiId(error) ? "This ID number is already in use" : "Failed to update admin");
  return apiSuccess("Admin updated successfully", data as ADMINDATA);
}

export async function deleteAdmin(auth: ADMINAUTH, id: string) {
  if (!isSuperAdmin(auth)) return apiError("Only a super admin can delete admins");
  if (auth.admin.id === id) return apiError("You cannot delete your own account");
  const { data, error } = await auth.adminSupabase
    .from("employees")
    .update({ isActive: false, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("id, isActive, updatedAt")
    .single();
  if (error) return apiError("Failed to deactivate admin");
  return apiSuccess("Admin deactivated successfully", data);
}
