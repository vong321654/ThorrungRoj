import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMINROLE } from "@/app/enums/admin";

export { ADMINROLE };

export function ISADMINROLE(value: unknown): value is ADMINROLE {
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
  /** Caller-scoped client. Database calls made with this client enforce RLS. */
  supabase: SupabaseClient;
  /** Backward-compatible alias for the caller-scoped client; it never bypasses RLS. */
  adminSupabase: SupabaseClient;
  admin: { id: string; role: ADMINROLE | null; isActive: boolean };
};

export type ADMINAUTHFAILURE = {
  message: string;
  statusCode: 401 | 403 | 500;
};

export type ADMINUPDATEPAYLOAD = Record<string, unknown>;
