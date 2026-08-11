import type { SaleType } from "@/app/productPage/_shared/domain/cartItem";

export type PaymentMethod = "cash" | "qrScan" | "pendingPayment" | "pendingCart";

export type CheckoutItemInput = {
  productId: number;
  quantity: number;
  saleType: SaleType;
};

export type CheckoutPayload = {
  items: CheckoutItemInput[];
  paymentMethod: PaymentMethod;
  deliveryAddress?: string;
  note?: string;
};

export type OrderItemRecord = {
  id: string;
  productId: number;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  saleType: SaleType;
};

export type OrderRecord = {
  id: string;
  totalAmount: number;
  paymentMethod: PaymentMethod | null;
  paymentStatus: string;
  status: string;
  deliveryAddress: string | null;
  note: string | null;
  createdAt: string;
  orderItems?: OrderItemRecord[];
};
