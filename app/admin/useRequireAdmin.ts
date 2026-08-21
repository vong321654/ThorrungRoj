"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminSession } from "./AdminSessionContext";
import { ADMINROLE } from "@/app/models/admin";

type RequireAdminOptions = {
  role?: ADMINROLE;
  redirectTo?: string;
};

export function useRequireAdmin(options: RequireAdminOptions = {}) {
  const { role, redirectTo = "/admin" } = options;
  const { admin, isLoading, error } = useAdminSession();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!admin) {
      router.replace("/admin/login");
      return;
    }
    if (role && admin.role !== role) {
      router.replace(redirectTo);
    }
  }, [admin, isLoading, role, redirectTo, router]);

  const isAllowed = !isLoading && !!admin && (!role || admin.role === role);

  return { admin, isLoading, error, isAllowed };
}
