export type AdminData = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  role: string | null;
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
