import type { Part } from "@/app/productPage/parts/_domain/entities";
import type { PartRepository } from "@/app/productPage/parts/_domain/partRepository";
import { MOCK_PARTS } from "./mockParts";

const MOCK_LATENCY_MS = 400;

export class MockPartRepository implements PartRepository {
  async listAllParts(): Promise<Part[]> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
    return MOCK_PARTS;
  }
}
