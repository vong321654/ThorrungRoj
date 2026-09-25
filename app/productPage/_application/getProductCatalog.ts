import type { Product, ProductFilterState } from "@/app/productPage/_domain/entities";

export function getProductCatalog(
  products: Product[],
  filter: ProductFilterState
): Product[] {
  return products.filter((product) => {
    const matchesBrand = filter.brandId === "" || product.brandId === filter.brandId;
    const matchesWeight = filter.weightKg === "" || product.weightKg === filter.weightKg;
    return matchesBrand && matchesWeight;
  });
}
