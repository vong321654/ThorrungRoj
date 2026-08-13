import type { AdminRole } from "./admin";

export type ADMINLOGINCREDENTIALS = {
  email: string;
  password: string;
};

export type CREATEADMINCREDENTIALS = ADMINLOGINCREDENTIALS & {
  email_confirm?: boolean;
  name: string | null;
  role: AdminRole;
  isActive: boolean;
};

export type { ADMINLOGINCREDENTIALS as AdminLoginCredentials, CREATEADMINCREDENTIALS as CreateAdminCredentials };
