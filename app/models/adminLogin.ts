import type { AdminRole } from "./admin";

export type AdminLoginCredentials = {
  email: string;
  password: string;
};

export type CreateAdminCredentials = AdminLoginCredentials & {
  email_confirm?: boolean;
  name: string | null;
  role: AdminRole;
  isActive: boolean;
};
