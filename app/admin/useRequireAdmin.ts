"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminSession } from "./AdminSessionContext";
import { ADMINROLE } from "@/app/models/admin";

type RequireAdminOptions = {
  role?: ADMINROLE;
  // อนุญาตหลายบทบาท เช่น admin กับ superAdmin แต่ไม่รวมพนักงาน
  roles?: ADMINROLE[];
  redirectTo?: string;
};

// หน้าจัดการร้านที่พนักงานทั่วไป (employee) ไม่ควรเข้า ถูกพาไปหน้าเวลาทำงานแทน
export const MANAGER_ONLY: RequireAdminOptions = {
  roles: [ADMINROLE.ADMIN, ADMINROLE.SUPER_ADMIN],
  redirectTo: "/admin/attendance",
};

export function useRequireAdmin(options: RequireAdminOptions = {}) {
  const { role, roles, redirectTo = "/admin" } = options;
  const { admin, isLoading, error } = useAdminSession();
  const router = useRouter();

  const hasRequiredRole = (adminRole: ADMINROLE | null | undefined) => {
    if (role && adminRole !== role) return false;
    if (roles && (!adminRole || !roles.includes(adminRole))) return false;
    return true;
  };
  // roles เป็น array ที่สร้างใหม่ทุกครั้งที่เรนเดอร์ จึงใช้ค่าสตริงเป็น dependency แทน
  const rolesKey = roles?.join(",") ?? "";

  useEffect(() => {
    if (isLoading) return;
    if (!admin) {
      router.replace("/admin/login");
      return;
    }
    if (!hasRequiredRole(admin.role)) {
      router.replace(redirectTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, isLoading, role, rolesKey, redirectTo, router]);

  const isAllowed = !isLoading && !!admin && hasRequiredRole(admin.role);

  return { admin, isLoading, error, isAllowed };
}
