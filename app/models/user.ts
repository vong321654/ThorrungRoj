export type UserId = string | number;

export type User = {
  id: string;
  lineUserId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  authId: string | null;
  lineDisplayName: string | null;
  contactName: string | null;
  shopName: string | null;
  customerType: string;
};

export type CurrentUser = Pick<
  User,
  "id" | "lineUserId" | "name" | "avatarUrl" | "isActive"
>;

export type UpdateUserPayload = Pick<User, "name" | "email" | "phone" | "address">;

export type LineProfile = {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
};
