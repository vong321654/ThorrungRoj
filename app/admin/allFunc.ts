"use client";

import { createClient } from "@/app/api/util/supabase/client";
import type { ApiResult } from "@/app/api/response";
import type { AdminData, UpdateAdminInput } from "@/app/models/admin";
import type { CreateAdminCredentials } from "@/app/models/adminLogin";

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
  const result = (await response.json()) as ApiResult<T>;
  if (!response.ok || result.status === "error") throw new Error(result.message);
  return result.results;
}

export function getAdmin() {
  return apiRequest<AdminData>("/api/admin/me");
}

export function getAdminsList() {
  return apiRequest<AdminData[]>("/api/admin");
}

export function getAdminByEmployeeId(id: string) {
  return apiRequest<AdminData>(`/api/admin?id=${encodeURIComponent(id)}`);
}

export function saveAdminChanges(input: UpdateAdminInput) {
  const { id, ...payload } = input;
  return apiRequest<AdminData>(`/api/admin?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function addAdmin(input: CreateAdminCredentials) {
  return apiRequest<{ employee: AdminData }>("/api/admin", {
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
