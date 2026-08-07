import type { Product } from "@/app/productPage/_domain/entities";
import type { ProductRepository } from "@/app/productPage/_domain/productRepository";
import { MOCK_PRODUCTS } from "./mockProducts";

const MOCK_LATENCY_MS = 400;

export class MockProductRepository implements ProductRepository {
  async listAllProducts(): Promise<Product[]> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
    return MOCK_PRODUCTS;
  }
}