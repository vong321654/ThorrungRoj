"use client";

import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import type { ADMINDATA, UPDATEADMININPUT } from "@/app/models/admin";
import type { CREATEADMINCREDENTIALS } from "@/app/models/adminLogin";
import type { DASHBOARDSTATS } from "@/app/models/dashboard";

export type { DASHBOARDSTATS } from "@/app/models/dashboard";

const supabase = createClient();

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("No active admin session");

  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  const result = (await response.json()) as APIRESULT<T>;
  if (!response.ok || result.status === "error") throw new Error(result.message);
  return result.results;
}

export function getAdmin() {
  return apiRequest<ADMINDATA>("/api/admin/me");
}

export function getDashboardStats() {
  return apiRequest<DASHBOARDSTATS>("/api/admin/dashboard");
}

export function getAdminsList() {
  return apiRequest<ADMINDATA[]>("/api/admin");
}

export function getAdminByEmployeeId(id: string) {
  return apiRequest<ADMINDATA>(`/api/admin?id=${encodeURIComponent(id)}`);
}

export function saveAdminChanges(input: UPDATEADMININPUT) {
  const { id, ...payload } = input;
  return apiRequest<ADMINDATA>(`/api/admin?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function addAdmin(input: CREATEADMINCREDENTIALS) {
  return apiRequest<{ employee: ADMINDATA }>("/api/admin", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteAdmin(id: string) {
  return apiRequest<{ id: string; isActive: boolean }>(`/api/admin?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Failed to sign out");
}
