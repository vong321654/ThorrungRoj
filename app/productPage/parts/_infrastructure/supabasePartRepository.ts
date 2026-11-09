import type { Part } from "@/app/productPage/parts/_domain/entities";
import type { PartRepository } from "@/app/productPage/parts/_domain/partRepository";
import type { APIRESULT } from "@/app/api/response";
import type { PRODUCT } from "@/app/models/product";
import { isGasCylinderProduct } from "@/app/util/productType";

type AvailableStock = { productId: number; availableQuantity: number };

export class SupabasePartRepository implements PartRepository {
  async listAllParts(): Promise<Part[]> {
    const [response, stockResponse] = await Promise.all([
      fetch("/api/product"),
      fetch("/api/inventory/available"),
    ]);
    const result = (await response.json()) as APIRESULT<PRODUCT[]>;
    if (result.status === "error") throw new Error(result.message);
    const stockResult = (await stockResponse.json()) as APIRESULT<AvailableStock[]>;
    if (stockResult.status === "error") throw new Error(stockResult.message);

    const availableByProduct = new Map(
      stockResult.results.map((item) => [item.productId, item.availableQuantity]),
    );

    return result.results
      // ทุกอย่างที่ไม่ใช่ถังแก๊สคืออะไหล่/อุปกรณ์ ไม่ผูกกับชื่อหรือ id ของประเภทอะไหล่
      .filter((product) => product.isActive !== false && !isGasCylinderProduct(product))
      .map((product) => ({
        id: String(product.id),
        name: product.name,
        price: Number(product.sellPrice),
        availableQuantity: availableByProduct.get(product.id) ?? 0,
      }));
  }
}
