import type { ADMINROLE } from "./admin";

export type ADMINLOGINCREDENTIALS = {
  email: string;
  password: string;
};

export type CREATEADMINCREDENTIALS = ADMINLOGINCREDENTIALS & {
  email_confirm?: boolean;
  name: string | null;
  role: ADMINROLE;
  isActive: boolean;
};
