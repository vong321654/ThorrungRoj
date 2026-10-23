import type { Product } from "@/app/productPage/_domain/entities";

export type FilterOptions = {
  brands: { value: number; label: string }[];
  weightsKg: number[];
};

export function getFilterOptions(products: Product[]): FilterOptions {
  const brandLabels = new Map<number, string>();
  const weights = new Set<number>();

  for (const product of products) {
    brandLabels.set(product.brandId, product.brandLabel);
    weights.add(product.weightKg);
  }

  return {
    brands: Array.from(brandLabels, ([value, label]) => ({ value, label })),
    weightsKg: Array.from(weights).sort((a, b) => a - b),
  };
}
