import { DEBTCHOICE } from "@/app/enums/debt";

export { DEBTCHOICE };

export type CREATEDEBTPAYLOAD = {
  orderId?: unknown;
  debtType?: unknown;
  note?: unknown;
};

// superAdmin บันทึกหนี้เองให้ลูกค้าที่โทรสั่งโดยไม่ผ่านหน้าเว็บ (ไม่มีออเดอร์ในระบบ)
export type MANUALDEBTPAYLOAD = {
  customer?: { name?: unknown; address?: unknown; phone?: unknown };
  debtType?: unknown;
  moneyAmount?: unknown;
  productId?: unknown;
  cartQuantity?: unknown;
  note?: unknown;
};

export type SETTLEDEBTPAYLOAD = {
  amount?: unknown;
  note?: unknown;
};

export type DEBTRECORDINSERT = {
  userId: string;
  orderId: string | null;
  recordedBy: string;
  debtType: Exclude<DEBTCHOICE, "both">;
  amount: number | string;
  note: string | null;
  productId?: number;
};
