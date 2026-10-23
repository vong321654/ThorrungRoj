import type { Part } from "@/app/productPage/parts/_domain/entities";
import type { PartRepository } from "@/app/productPage/parts/_domain/partRepository";
import type { APIRESULT } from "@/app/api/response";
import type { PRODUCT } from "@/app/models/product";

const PART_TYPE_ID = 16; // "อะไหล่" ใน types

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
      .filter((product) => product.isActive !== false && product.typeId === PART_TYPE_ID)
      .map((product) => ({
        id: String(product.id),
        name: product.name,
        price: Number(product.sellPrice),
        availableQuantity: availableByProduct.get(product.id) ?? 0,
      }));
  }
}
