import type { SaleType } from "@/app/productPage/_shared/domain/cartItem";
import { ORDERPAYMENTSTATUS, ORDERSTATUS, PAYMENTMETHOD } from "@/app/enums/order";
import type { CUSTOMERTYPE } from "@/app/enums/customer";
import type { ProductTypeEmbed } from "@/app/util/productType";

export { ORDERPAYMENTSTATUS, ORDERSTATUS, PAYMENTMETHOD };

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
  deliveryLat?: number | null;
  deliveryLng?: number | null;
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
  rejectReason?: string | null;
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
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  note: string | null;
  customerType?: CUSTOMERTYPE;
  createdAt: string;
  orderItems?: ORDERITEMRECORD[];
  payments?: ORDERPAYMENTRECORD[];
  outstandingAmount?: number;
  outstandingCarts?: number;
  promptPayQrUrl?: string | null;
};

export type CUSTOMERORDERPROFILE = {
  id: string;
  address: string | null;
  isActive: boolean;
  customerType: string;
  customerTypeChosenAt: string | null;
};

export type PRODUCTPRICINGROW = {
  id: number;
  name: string;
  sellPrice: number | string;
  exchangePrice: number | string | null;
  refillPrice: number | string | null;
  shopExchangePrice: number | string | null;
  shopRefillPrice: number | string | null;
  isActive: boolean;
  typeId: number;
  productsType?: ProductTypeEmbed;
};

export type ADMINORDERUPDATEPAYLOAD = {
  orderId?: unknown;
  paymentStatus?: unknown;
  orderStatus?: unknown;
};

export type ORDERUPDATEVALUES = Record<string, string>;
