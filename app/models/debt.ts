import { DEBTCHOICE } from "@/app/enums/debt";

export { DEBTCHOICE };

export type CREATEDEBTPAYLOAD = {
  orderId?: unknown;
  debtType?: unknown;
  note?: unknown;
};

export type SETTLEDEBTPAYLOAD = {
  amount?: unknown;
  note?: unknown;
};

export type DEBTRECORDINSERT = {
  userId: string;
  orderId: string;
  recordedBy: string;
  debtType: Exclude<DEBTCHOICE, "both">;
  amount: number | string;
  note: string | null;
  productId?: number;
};

export type { CREATEDEBTPAYLOAD as CreateDebtPayload, SETTLEDEBTPAYLOAD as SettleDebtPayload, DEBTRECORDINSERT as DebtRecordInsert };
