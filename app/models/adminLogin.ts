export type AdminLoginCredentials = {
  email: string;
  password: string;
};

export type CreateAdminCredentials = AdminLoginCredentials & {
  email_confirm?: boolean;
};
