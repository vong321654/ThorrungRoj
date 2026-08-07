"use server";

import { cookies } from "next/headers";
import { createClient } from "@/app/api/util/supabase/server";

export async function hasActiveAdminSession() {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getUser();
  return !error && data.user !== null;
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
