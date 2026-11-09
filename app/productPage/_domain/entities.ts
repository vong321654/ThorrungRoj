export type Product = {
  id: string;
  brandId: number;
  brandLabel: string;
  weightKg: number;
  sellPrice: number;
  exchangePrice: number;
  refillPrice: number;
  // ราคาร้านค้า 0 = ไม่ได้ตั้ง ใช้ราคาปกติ
  shopExchangePrice: number;
  shopRefillPrice: number;
  availableQuantity?: number;
  imageUrl?: string | null;
};

export type ProductFilterState = {
  brandId: number | "";
  weightKg: number | "";
};

export const EMPTY_PRODUCT_FILTER: ProductFilterState = {
  brandId: "",
  weightKg: "",
};
