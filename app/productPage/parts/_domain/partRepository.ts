import type { Part } from "./entities";

export interface PartRepository {
  listAllParts(): Promise<Part[]>;
}
