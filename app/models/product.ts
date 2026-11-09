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
  refillPrice: number | null;
  // ราคาร้านค้า 0 = ไม่ได้ตั้ง ใช้ราคาปกติ
  shopExchangePrice: number;
  shopRefillPrice: number;
  imageUrl?: string | null;
  isActive: boolean;
  // ชื่อประเภท ดึงมากับ GET /api/product ใช้กับ isGasCylinderProduct()
  productsType?: { name: string | null } | null;
};

export type PRODUCTINPUT = Omit<
  PRODUCT,
  "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"
>;

export type PRODUCTPAYLOAD = Record<string, unknown>;
