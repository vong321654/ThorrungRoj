import type { Part } from "@/app/productPage/parts/_domain/entities";
import type { PartRepository } from "@/app/productPage/parts/_domain/partRepository";

export async function getPartCatalog(repository: PartRepository): Promise<Part[]> {
  return repository.listAllParts();
}
