export type PRODUCT = {
  id: number;
  name: string;
  brandId: number;
  size: number | null;
  typeId: number;
  sellPrice: number;
  unitId: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
  exchangePrice: number;
  refillPrice: number;
  imageUrl?: string | null;
  isActive: boolean;
};

export type PRODUCTINPUT = Omit<
  PRODUCT,
  "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"
>;

export type PRODUCTPAYLOAD = Record<string, unknown>;

export type { PRODUCTPAYLOAD as ProductPayload };
