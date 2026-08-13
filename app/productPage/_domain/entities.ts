export type Product = {
  id: string;
  brandId: number;
  brandLabel: string;
  weightKg: number;
  sellPrice: number;
  exchangePrice: number;
  refillPrice: number;
  availableQuantity?: number;
};

export type ProductFilterState = {
  brandId: number | "";
  weightKg: number | "";
};

export const EMPTY_PRODUCT_FILTER: ProductFilterState = {
  brandId: "",
  weightKg: "",
};
