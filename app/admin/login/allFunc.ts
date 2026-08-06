import { signInWithEmail } from "../../api/services/adminService";

export async function loginWithEmail(email: string, password: string) {
  const result = await signInWithEmail({ email, password });
  return result.data;
}
