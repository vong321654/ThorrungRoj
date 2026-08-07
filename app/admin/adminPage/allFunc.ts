import {
  signOut,
  getAllAdmins,
  getAdminById,
  updateAdmin,
} from "@/app/api/services/adminService";
import { createClient } from "@/app/api/util/supabase/client";
import type { AdminData, UpdateAdminInput } from "@/app/models/admin";

export async function getAdmin(): Promise<AdminData> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("No active admin session");
  }

  const response = await fetch("/api/admin/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const result = (await response.json()) as {
    status: "success" | "error";
    message: string;
    results: AdminData | null;
  };

  if (!response.ok || result.status === "error") {
    throw new Error(result.message);
  }

  if (!result.results) {
    throw new Error("No admin data found");
  }

  return result.results;
}
export async function signOutAdmin() {
  const result = await signOut();
  if (result.status === "error") {
    throw new Error(result.message);
  }
  location.pathname = "/admin/login";
}
export async function getAdminsList() {
  const result = await getAllAdmins();
  if (result.status === "error") {
    throw new Error(result.message);
  }
  return result.results;
}

export async function getAdminByEmployeeId(id: string): Promise<AdminData> {
  const result = await getAdminById(id);
  if (result.status === "error" || !result.results) {
    throw new Error(result.message);
  }
  return result.results;
}

export async function saveAdminChanges(input: UpdateAdminInput): Promise<AdminData> {
  const result = await updateAdmin(input);
  if (result.status === "error" || !result.results) {
    throw new Error(result.message);
  }
  return result.results;
}
