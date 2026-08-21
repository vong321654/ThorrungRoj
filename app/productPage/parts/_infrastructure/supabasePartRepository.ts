import type { Part } from "@/app/productPage/parts/_domain/entities";
import type { PartRepository } from "@/app/productPage/parts/_domain/partRepository";
import type { APIRESULT } from "@/app/api/response";
import type { PRODUCT } from "@/app/models/product";

const PART_TYPE_ID = 16; // "อะไหล่" ใน types

export class SupabasePartRepository implements PartRepository {
  async listAllParts(): Promise<Part[]> {
    const response = await fetch("/api/product");
    const result = (await response.json()) as APIRESULT<PRODUCT[]>;
    if (result.status === "error") throw new Error(result.message);

    return result.results
      .filter((product) => product.isActive !== false && product.typeId === PART_TYPE_ID)
      .map((product) => ({
        id: String(product.id),
        name: product.name,
        price: Number(product.sellPrice),
      }));
  }
}
