export type ProductBrand = "ptt" | "worldGas" | "siamGas";

export type Product = {
  id: string;
  brand: ProductBrand;
  brandLabel: string;
  weightKg: number;
  price: number;
};

export type ProductFilterState = {
  brand: ProductBrand | "";
  weightKg: number | "";
};

export const EMPTY_PRODUCT_FILTER: ProductFilterState = {
  brand: "",
  weightKg: "",
};