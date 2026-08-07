import {
  getAdminSession,
  signInWithEmail,
} from "../../api/services/adminService";

export async function hasActiveAdminSession() {
  const result = await getAdminSession();
  return result.status === "success" && result.results !== null;
}

export async function loginWithEmail(email: string, password: string) {
  const result = await signInWithEmail({ email, password });
  if (result.status === "error") {
    throw new Error(result.message);
  }
  return result.results;
}
