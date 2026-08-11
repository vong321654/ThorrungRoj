import type { Product } from "@/app/productPage/_domain/entities";

const BRAND_LABELS: Record<number, string> = {
  1: "ปตท.",
  2: "เวิลด์แก๊ส",
  3: "สยามแก๊ส",
};

export const MOCK_PRODUCTS: Product[] = [
  { id: "1-4", brandId: 1, brandLabel: BRAND_LABELS[1], weightKg: 4, sellPrice: 1290, exchangePrice: 450, refillPrice: 400 },
  { id: "1-7", brandId: 1, brandLabel: BRAND_LABELS[1], weightKg: 7, sellPrice: 1490, exchangePrice: 650, refillPrice: 600 },
  { id: "1-15", brandId: 1, brandLabel: BRAND_LABELS[1], weightKg: 15, sellPrice: 1590, exchangePrice: 950, refillPrice: 900 },
  { id: "2-4", brandId: 2, brandLabel: BRAND_LABELS[2], weightKg: 4, sellPrice: 1299, exchangePrice: 450, refillPrice: 400 },
  { id: "2-7", brandId: 2, brandLabel: BRAND_LABELS[2], weightKg: 7, sellPrice: 1499, exchangePrice: 650, refillPrice: 600 },
  { id: "2-15", brandId: 2, brandLabel: BRAND_LABELS[2], weightKg: 15, sellPrice: 1599, exchangePrice: 950, refillPrice: 900 },
  { id: "3-4", brandId: 3, brandLabel: BRAND_LABELS[3], weightKg: 4, sellPrice: 1280, exchangePrice: 450, refillPrice: 400 },
  { id: "3-7", brandId: 3, brandLabel: BRAND_LABELS[3], weightKg: 7, sellPrice: 1480, exchangePrice: 650, refillPrice: 600 },
  { id: "3-15", brandId: 3, brandLabel: BRAND_LABELS[3], weightKg: 15, sellPrice: 1580, exchangePrice: 950, refillPrice: 900 },
];
