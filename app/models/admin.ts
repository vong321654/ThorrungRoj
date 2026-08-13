import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMINROLE } from "@/app/enums/admin";

export { ADMINROLE };
export const AdminRole = {
  SuperAdmin: ADMINROLE.SUPER_ADMIN,
  Admin: ADMINROLE.ADMIN,
  Employee: ADMINROLE.EMPLOYEE,
} as const;
export type AdminRole = ADMINROLE;

export function isAdminRole(value: unknown): value is ADMINROLE {
  return Object.values(ADMINROLE).includes(value as ADMINROLE);
}

export type ADMINDATA = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  role: ADMINROLE;
  createdAt: string;
  updatedAt: string;
  authId: string | null;
  address: string | null;
  tel: string | null;
  thaiId: string | null;
};

export type UPDATEADMININPUT = Partial<
  Pick<
    ADMINDATA,
    "avatarUrl" | "isActive" | "role" | "address" | "tel" | "thaiId"
  >
> & {
  id: string;
  name?: string | null;
};

export type ADMINAUTH = {
  supabase: SupabaseClient;
  admin: { id: string; role: ADMINROLE | null; isActive: boolean };
};

export type ADMINAUTHFAILURE = {
  message: string;
  statusCode: 401 | 403 | 500;
};

export type ADMINUPDATEPAYLOAD = Record<string, unknown>;

export type { ADMINDATA as AdminData, UPDATEADMININPUT as UpdateAdminInput, ADMINAUTH as AdminAuth, ADMINAUTHFAILURE as AdminAuthFailure, ADMINUPDATEPAYLOAD as AdminUpdatePayload };
