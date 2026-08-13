export type USERID = string | number;

export type USER = {
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

export type CURRENTUSER = Pick<
  USER,
  "id" | "lineUserId" | "name" | "avatarUrl" | "address" | "isActive"
>;

export type UPDATEUSERPAYLOAD = Pick<USER, "name" | "email" | "phone" | "address">;

export type ADMINUSERUPDATEPAYLOAD = Record<string, unknown>;
export type ADMINUSERUPDATEVALUES = Record<string, string | boolean | null>;

export type LINEPROFILE = {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
};

export type { USERID as UserId, USER as User, CURRENTUSER as CurrentUser, UPDATEUSERPAYLOAD as UpdateUserPayload, ADMINUSERUPDATEPAYLOAD as AdminUserUpdatePayload, ADMINUSERUPDATEVALUES as AdminUserUpdateValues, LINEPROFILE as LineProfile };
