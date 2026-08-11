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
