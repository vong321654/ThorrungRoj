export enum AdminRole {
  SuperAdmin = "superAdmin",
  Admin = "admin",
  Employee = "employee",
}

export function isAdminRole(value: unknown): value is AdminRole {
  return Object.values(AdminRole).includes(value as AdminRole);
}

export type AdminData = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  role: AdminRole | null;
  address?: string | null;
  tel?: string | null;
  thaiId?: string | null;
  updatedAt: string | null;
};

export type UpdateAdminInput = Partial<
  Pick<AdminData, "name" | "avatarUrl" | "isActive" | "role">
> & {
  id: string;
};
