export enum PAYMENTMETHOD {
  CASH = "cash",
  QR_SCAN = "qrScan",
  PENDING_PAYMENT = "pendingPayment",
  PENDING_CART = "pendingCart",
  PENDING_BOTH = "pendingBoth",
}

export enum ORDERPAYMENTSTATUS {
  AWAITING_PAYMENT = "awaitingPayment",
  PAID = "paid",
  PENDING = "pending",
  PENDING_PAYMENT = "pendingPayment",
  PENDING_CART = "pendingCart",
  PENDING_BOTH = "pendingBoth",
}

/** ผลที่ superAdmin เลือกตอนอัปโหลดสลิปแทนลูกค้า */
export enum MANUALSLIPOUTCOME {
  /** ได้รับเงินครบ */
  PAID = "paid",
  /** ได้รับเงินบางส่วน ส่วนที่เหลือเป็นหนี้เงิน */
  PENDING_PAYMENT = "pendingPayment",
  /** ได้รับเงินครบ แต่ยังไม่คืนถังเปล่า */
  PENDING_CART = "pendingCart",
  /** ได้รับเงินบางส่วนและยังไม่คืนถังเปล่า */
  PENDING_BOTH = "pendingBoth",
}

export enum ORDERSTATUS {
  PENDING = "pending",
  PREPARING = "preparing",
  DELIVERING = "delivering",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
}

export enum SALETYPE {
  SELL = "sell",
  EXCHANGE = "exchange",
  REFILL = "refill",
  RETURN = "return",
}
