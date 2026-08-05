import type { JwtPayload } from "jsonwebtoken";

export type UserId = string | number;

export type User = {
  id: UserId;
  lineUserId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

export type UserSessionPayload = JwtPayload & {
  userId?: UserId;
  lineUserId?: string;
};
