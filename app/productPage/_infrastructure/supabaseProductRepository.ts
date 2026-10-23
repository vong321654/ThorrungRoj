import type { Product } from "@/app/productPage/_domain/entities";
import type { ProductRepository } from "@/app/productPage/_domain/productRepository";
import type { APIRESULT } from "@/app/api/response";
import type { PRODUCT } from "@/app/models/product";
import type { PRODUCTBAND } from "@/app/models/productsType";

type AvailableStock = { productId: number; availableQuantity: number };

const TANK_TYPE_ID = 14; // "ถังแก๊ส" ใน types

export class SupabaseProductRepository implements ProductRepository {
  async listAllProducts(): Promise<Product[]> {
    const [productsResponse, brandsResponse, inventoryResponse] = await Promise.all([
      fetch("/api/product"),
      fetch("/api/product/brand"),
      fetch("/api/inventory/available"),
    ]);

    const productsResult = (await productsResponse.json()) as APIRESULT<PRODUCT[]>;
    if (productsResult.status === "error") throw new Error(productsResult.message);

    const brandsResult = (await brandsResponse.json()) as APIRESULT<PRODUCTBAND[]>;
    if (brandsResult.status === "error") throw new Error(brandsResult.message);
    const inventoryResult = (await inventoryResponse.json()) as APIRESULT<AvailableStock[]>;
    if (inventoryResult.status === "error") throw new Error(inventoryResult.message);

    const brandLabels = new Map(brandsResult.results.map((brand) => [brand.id, brand.name]));
    // ตัวเลขเดียวกับที่ server ใช้ตรวจตอนสั่งซื้อ (หักออเดอร์ที่ยังไม่ส่งแล้ว)
    const availableByProduct = new Map(
      inventoryResult.results.map((item) => [item.productId, item.availableQuantity]),
    );

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
        imageUrl: product.imageUrl?.trim() || null,
      }));
  }
}
