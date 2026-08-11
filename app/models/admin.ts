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
  name: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  role: AdminRole;
  createdAt: string;
  updatedAt: string;
  authId: string | null;
  address: string | null;
  tel: string | null;
  thaiId: string | null;
};

export type UpdateAdminInput = Partial<
  Pick<
    AdminData,
    "avatarUrl" | "isActive" | "role" | "address" | "tel" | "thaiId"
  >
> & {
  id: string;
  name?: string | null;
};
