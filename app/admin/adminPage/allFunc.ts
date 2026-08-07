"use server";

import { cookies } from "next/headers";
import { createClient } from "@/app/api/util/supabase/server";
import { AdminRole, type AdminData, type UpdateAdminInput } from "@/app/models/admin";

const adminFields =
  "id, email, name, avatarUrl, isActive, role, address, tel, thaiId, updatedAt";

export async function getAdmin(): Promise<AdminData> {
  const supabase = createClient(await cookies());
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("No active admin session");
  }

  const { data, error } = await supabase
    .from("employees")
    .select(adminFields)
    .eq("authId", authData.user.id)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Admin profile not found");
  }

  return data as AdminData;
}

export async function signOutAdmin() {
  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Failed to sign out");
}

export async function getAdminsList(): Promise<AdminData[]> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("employees")
    .select(adminFields)
    .neq("role", AdminRole.SuperAdmin);

  if (error) throw new Error("Failed to get all admins");
  return (data ?? []) as AdminData[];
}

export async function getAdminByEmployeeId(id: string): Promise<AdminData> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("employees")
    .select(adminFields)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) throw new Error("Admin not found");
  return data as AdminData;
}

export async function saveAdminChanges(
  input: UpdateAdminInput,
): Promise<AdminData> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("employees")
    .update({
      name: input.name,
      avatarUrl: input.avatarUrl,
      isActive: input.isActive,
      role: input.role,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select(adminFields)
    .single();

  if (error || !data) throw new Error("Failed to update admin");
  return data as AdminData;
}
