import type { Product } from "@/app/productPage/_domain/entities";
import type { ProductRepository } from "@/app/productPage/_domain/productRepository";
import type { ApiResult } from "@/app/api/response";
import type { PRODUCT } from "@/app/models/product";
import type { PRODUCTBAND } from "@/app/models/productsType";

export class SupabaseProductRepository implements ProductRepository {
  async listAllProducts(): Promise<Product[]> {
    const [productsResponse, brandsResponse] = await Promise.all([
      fetch("/api/product"),
      fetch("/api/product/brand"),
    ]);

    const productsResult = (await productsResponse.json()) as ApiResult<PRODUCT[]>;
    if (productsResult.status === "error") throw new Error(productsResult.message);

    const brandsResult = (await brandsResponse.json()) as ApiResult<PRODUCTBAND[]>;
    if (brandsResult.status === "error") throw new Error(brandsResult.message);

    const brandLabels = new Map(brandsResult.results.map((brand) => [brand.id, brand.name]));

    return productsResult.results
      .filter(
        (product): product is PRODUCT & { size: number } =>
          product.isActive !== false && product.size !== null,
      )
      .map((product) => ({
        id: String(product.id),
        brandId: product.brandId,
        brandLabel: brandLabels.get(product.brandId) ?? "ไม่ระบุยี่ห้อ",
        weightKg: product.size,
        sellPrice: Number(product.sellPrice),
        exchangePrice: Number(product.exchangePrice),
        refillPrice: Number(product.refillPrice),
      }));
  }
}
