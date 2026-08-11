import type { ProductRepository } from "@/app/productPage/_domain/productRepository";

export type FilterOptions = {
  brands: { value: number; label: string }[];
  weightsKg: number[];
};

export async function getFilterOptions(repository: ProductRepository): Promise<FilterOptions> {
  const products = await repository.listAllProducts();

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