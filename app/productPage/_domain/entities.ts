export type Product = {
  id: string;
  brandId: number;
  brandLabel: string;
  weightKg: number;
  price: number;
};

export type ProductFilterState = {
  brandId: number | "";
  weightKg: number | "";
};

export const EMPTY_PRODUCT_FILTER: ProductFilterState = {
  brandId: "",
  weightKg: "",
};
