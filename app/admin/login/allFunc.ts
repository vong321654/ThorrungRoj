import { signInWithEmail } from "../../api/services/adminService";

export async function loginWithEmail(email: string, password: string) {
  return signInWithEmail(email, password);
}
