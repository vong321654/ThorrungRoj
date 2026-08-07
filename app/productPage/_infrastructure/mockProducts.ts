import type { Product, ProductBrand } from "@/app/productPage/_domain/entities";

const BRAND_LABELS: Record<ProductBrand, string> = {
  ptt: "ปตท.",
  worldGas: "เวิลด์แก๊ส",
  siamGas: "สยามแก๊ส",
};

export const MOCK_PRODUCTS: Product[] = [
  { id: "ptt-4", brand: "ptt", brandLabel: BRAND_LABELS.ptt, weightKg: 4, price: 1290 },
  { id: "ptt-7", brand: "ptt", brandLabel: BRAND_LABELS.ptt, weightKg: 7, price: 1490 },
  { id: "ptt-15", brand: "ptt", brandLabel: BRAND_LABELS.ptt, weightKg: 15, price: 1590 },
  { id: "worldGas-4", brand: "worldGas", brandLabel: BRAND_LABELS.worldGas, weightKg: 4, price: 1299 },
  { id: "worldGas-7", brand: "worldGas", brandLabel: BRAND_LABELS.worldGas, weightKg: 7, price: 1499 },
  { id: "worldGas-15", brand: "worldGas", brandLabel: BRAND_LABELS.worldGas, weightKg: 15, price: 1599 },
  { id: "siamGas-4", brand: "siamGas", brandLabel: BRAND_LABELS.siamGas, weightKg: 4, price: 1280 },
  { id: "siamGas-7", brand: "siamGas", brandLabel: BRAND_LABELS.siamGas, weightKg: 7, price: 1480 },
  { id: "siamGas-15", brand: "siamGas", brandLabel: BRAND_LABELS.siamGas, weightKg: 15, price: 1580 },
];