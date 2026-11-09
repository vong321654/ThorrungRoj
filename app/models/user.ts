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
  privacyPolicyVersion: string | null;
  privacyAcknowledgedAt: string | null;
  erasedAt: string | null;
  customerTypeChosenAt: string | null;
  shopRequestStatus: string | null;
};

export type CURRENTUSER = Pick<
  USER,
  | "id"
  | "lineUserId"
  | "name"
  | "avatarUrl"
  | "address"
  | "isActive"
  | "privacyPolicyVersion"
  | "customerType"
  | "customerTypeChosenAt"
  | "shopRequestStatus"
>;

export const CURRENTUSER_FIELDS =
  "id, lineUserId, name, avatarUrl, address, isActive, privacyPolicyVersion, customerType, customerTypeChosenAt, shopRequestStatus";

// คอลัมน์ลูกค้าที่หน้า admin/users ใช้ ทั้งรายการลูกค้าและตารางคำขอเป็นร้านค้า
export const ADMIN_CUSTOMER_FIELDS =
  "id, name, phone, email, address, avatarUrl, contactName, shopName, customerType, shopRequestStatus, customerTypeChosenAt, isActive, createdAt";

export type UPDATEUSERPAYLOAD = Pick<USER, "name" | "email" | "phone" | "address">;

export type ADMINUSERUPDATEPAYLOAD = Record<string, unknown>;
export type ADMINUSERUPDATEVALUES = Record<string, string | boolean | null>;

export type LINEPROFILE = {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
};
