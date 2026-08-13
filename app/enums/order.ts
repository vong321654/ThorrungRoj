export enum PAYMENTMETHOD {
  CASH = "cash",
  QR_SCAN = "qrScan",
  PENDING_PAYMENT = "pendingPayment",
  PENDING_CART = "pendingCart",
}

export enum ORDERPAYMENTSTATUS {
  AWAITING_PAYMENT = "awaitingPayment",
  PAID = "paid",
  PENDING = "pending",
  PENDING_PAYMENT = "pendingPayment",
  PENDING_CART = "pendingCart",
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
