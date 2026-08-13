"use client";

import { useCart } from "@/app/productPage/_shared/CartContext";
import type { Part } from "@/app/productPage/parts/_domain/entities";
import PartGrid from "./components/PartGrid";
import { usePartCatalog } from "./hooks/usePartCatalog";

export default function PartCatalogView() {
  const { parts, isLoading } = usePartCatalog();
  const cart = useCart();

  function handleSelect(part: Part) {
    cart.addItem({
      id: `part:${part.id}`,
      productId: Number(part.id),
      source: "part",
      name: part.name,
      price: part.price,
      saleType: "sell",
    });
  }

  return <PartGrid parts={parts} isLoading={isLoading} onSelect={handleSelect} />;
}
