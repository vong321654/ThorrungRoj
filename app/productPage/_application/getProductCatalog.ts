import type { Product, ProductFilterState } from "@/app/productPage/_domain/entities";
import type { ProductRepository } from "@/app/productPage/_domain/productRepository";

export async function getProductCatalog(
  repository: ProductRepository,
  filter: ProductFilterState
): Promise<Product[]> {
  const products = await repository.listAllProducts();

  return products.filter((product) => {
    const matchesBrand = filter.brand === "" || product.brand === filter.brand;
    const matchesWeight = filter.weightKg === "" || product.weightKg === filter.weightKg;
    return matchesBrand && matchesWeight;
  });
}