import { createClient } from "../util/supabase/client";

const supabase = createClient();

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });
  if (error) {
    console.error("SIGN IN ERROR:", error.message);
    throw new Error("Failed to sign in");
  }
  console.log("SIGN IN DATA:", data);
  return data;
}
export async function getCurrentAdmin() {
  const admin = await supabase.auth.getUser();
  console.log("getCurrentAdmin called", admin);
  return admin;
}
export async function signOut() {
  return supabase.auth.signOut();
}
