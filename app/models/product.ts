export const PRODUCT_SALE_TYPES = [
  { value: "exchange", label: "แลกถัง" },
  { value: "refill", label: "เติมแก๊ส" },
] as const;

export type ProductSaleType = (typeof PRODUCT_SALE_TYPES)[number]["value"];

export type PRODUCT = {
  id: number;
  name: string;
  brandId: number;
  size: number | null;
  typeId: number;
  sellPrice: number;
  unitId: number;
  saleType: "sell" | "exchange" | "refill" | "return";
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
  exchangePrice: number;
  refillPrice: number;
  isActive: boolean;
};

export type PRODUCTINPUT = Omit<PRODUCT, "id" | "createdAt" | "updatedAt">;
