"use server";

import { cookies } from "next/headers";
import { createClient } from "@/app/api/util/supabase/server";
import { createAdminClient } from "@/app/api/util/supabase/admin";

export async function hasActiveAdminSession() {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;

  const { data: employee, error: employeeError } = await createAdminClient()
    .from("employees")
    .select("id")
    .eq("authId", data.user.id)
    .eq("isActive", true)
    .maybeSingle();

  return !employeeError && employee !== null;
}

export async function loginWithEmail(email: string, password: string) {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error("Failed to sign in");
  return data;
}
