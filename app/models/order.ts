import type { SaleType } from "@/app/productPage/_shared/domain/cartItem";
import { ORDERPAYMENTSTATUS, ORDERSTATUS, PAYMENTMETHOD } from "@/app/enums/order";

export { ORDERPAYMENTSTATUS, ORDERSTATUS, PAYMENTMETHOD };
export type OrderPaymentStatus = `${ORDERPAYMENTSTATUS}`;
export type OrderStatus = `${ORDERSTATUS}`;
export type PaymentMethod = `${PAYMENTMETHOD}`;

export type CHECKOUTITEMINPUT = {
  productId: number;
  quantity: number;
  saleType: SaleType;
};

export type CHECKOUTPAYLOAD = {
  items: CHECKOUTITEMINPUT[];
  paymentMethod: PAYMENTMETHOD;
  deliveryAddress?: string;
  note?: string;
};

export type ORDERITEMRECORD = {
  id: string;
  productId: number;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  saleType: SaleType;
};

export type TRANSFERSLIPRECORD = {
  id: string;
  status: string;
  createdAt: string;
};

export type ORDERPAYMENTRECORD = {
  id: string;
  method: PAYMENTMETHOD;
  status: string;
  transferSlips?: TRANSFERSLIPRECORD[];
};

export type ORDERRECORD = {
  id: string;
  totalAmount: number;
  paymentMethod: PAYMENTMETHOD | null;
  paymentStatus: string;
  status: string;
  deliveryAddress: string | null;
  note: string | null;
  createdAt: string;
  orderItems?: ORDERITEMRECORD[];
  payments?: ORDERPAYMENTRECORD[];
};

export type CUSTOMERORDERPROFILE = {
  id: string;
  address: string | null;
  isActive: boolean;
};

export type PRODUCTPRICINGROW = {
  id: number;
  name: string;
  sellPrice: number | string;
  exchangePrice: number | string | null;
  refillPrice: number | string | null;
  isActive: boolean;
};

export type ADMINORDERUPDATEPAYLOAD = {
  orderId?: unknown;
  paymentStatus?: unknown;
  orderStatus?: unknown;
};

export type ORDERUPDATEVALUES = Record<string, string>;

export type { CHECKOUTITEMINPUT as CheckoutItemInput, CHECKOUTPAYLOAD as CheckoutPayload, ORDERITEMRECORD as OrderItemRecord, TRANSFERSLIPRECORD as TransferSlipRecord, ORDERPAYMENTRECORD as OrderPaymentRecord, ORDERRECORD as OrderRecord, CUSTOMERORDERPROFILE as CustomerOrderProfile, PRODUCTPRICINGROW as ProductPricingRow, ADMINORDERUPDATEPAYLOAD as AdminOrderUpdatePayload, ORDERUPDATEVALUES as OrderUpdateValues };
