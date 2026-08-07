import type { Product } from "./entities";

export interface ProductRepository {
  listAllProducts(): Promise<Product[]>;
}