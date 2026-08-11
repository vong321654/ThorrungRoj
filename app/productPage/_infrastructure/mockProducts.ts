import type { Product } from "@/app/productPage/_domain/entities";

const BRAND_LABELS: Record<number, string> = {
  1: "ปตท.",
  2: "เวิลด์แก๊ส",
  3: "สยามแก๊ส",
};

export const MOCK_PRODUCTS: Product[] = [
  { id: "1-4", brandId: 1, brandLabel: BRAND_LABELS[1], weightKg: 4, price: 1290 },
  { id: "1-7", brandId: 1, brandLabel: BRAND_LABELS[1], weightKg: 7, price: 1490 },
  { id: "1-15", brandId: 1, brandLabel: BRAND_LABELS[1], weightKg: 15, price: 1590 },
  { id: "2-4", brandId: 2, brandLabel: BRAND_LABELS[2], weightKg: 4, price: 1299 },
  { id: "2-7", brandId: 2, brandLabel: BRAND_LABELS[2], weightKg: 7, price: 1499 },
  { id: "2-15", brandId: 2, brandLabel: BRAND_LABELS[2], weightKg: 15, price: 1599 },
  { id: "3-4", brandId: 3, brandLabel: BRAND_LABELS[3], weightKg: 4, price: 1280 },
  { id: "3-7", brandId: 3, brandLabel: BRAND_LABELS[3], weightKg: 7, price: 1480 },
  { id: "3-15", brandId: 3, brandLabel: BRAND_LABELS[3], weightKg: 15, price: 1580 },
];
