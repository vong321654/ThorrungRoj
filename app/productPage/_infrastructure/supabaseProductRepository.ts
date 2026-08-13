import type { Product } from "@/app/productPage/_domain/entities";
import type { ProductRepository } from "@/app/productPage/_domain/productRepository";
import type { ApiResult } from "@/app/api/response";
import type { PRODUCT } from "@/app/models/product";
import type { PRODUCTBAND } from "@/app/models/productsType";

type InventoryItem = { productId: number | string; stockStatus: string; quantityAvailable: number | string | null };

const TANK_TYPE_ID = 14; // "ถังแก๊ส" ใน types

export class SupabaseProductRepository implements ProductRepository {
  async listAllProducts(): Promise<Product[]> {
    const [productsResponse, brandsResponse, inventoryResponse] = await Promise.all([
      fetch("/api/product"),
      fetch("/api/product/brand"),
      fetch("/api/inventory"),
    ]);

    const productsResult = (await productsResponse.json()) as ApiResult<PRODUCT[]>;
    if (productsResult.status === "error") throw new Error(productsResult.message);

    const brandsResult = (await brandsResponse.json()) as ApiResult<PRODUCTBAND[]>;
    if (brandsResult.status === "error") throw new Error(brandsResult.message);
    const inventoryResult = (await inventoryResponse.json()) as ApiResult<InventoryItem[]>;
    if (inventoryResult.status === "error") throw new Error(inventoryResult.message);

    const brandLabels = new Map(brandsResult.results.map((brand) => [brand.id, brand.name]));
    const availableByProduct = new Map<number, number>();
    for (const item of inventoryResult.results) {
      if (item.stockStatus !== "full") continue;
      const productId = Number(item.productId);
      availableByProduct.set(productId, (availableByProduct.get(productId) ?? 0) + Number(item.quantityAvailable ?? 0));
    }

    return productsResult.results
      .filter(
        (product): product is PRODUCT & { size: number } =>
          product.isActive !== false &&
          product.typeId === TANK_TYPE_ID &&
          product.size !== null,
      )
      .map((product) => ({
        id: String(product.id),
        brandId: product.brandId,
        brandLabel: brandLabels.get(product.brandId) ?? "ไม่ระบุยี่ห้อ",
        weightKg: product.size,
        sellPrice: Number(product.sellPrice),
        exchangePrice: Number(product.exchangePrice),
        refillPrice: Number(product.refillPrice),
        availableQuantity: availableByProduct.get(product.id) ?? 0,
      }));
  }
}
