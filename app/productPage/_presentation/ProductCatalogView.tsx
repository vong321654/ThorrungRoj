"use client";

import Alert from "@mui/material/Alert";
import { useCart } from "@/app/productPage/_shared/CartContext";
import type { SaleType } from "@/app/productPage/_shared/domain/cartItem";
import type { Product } from "@/app/productPage/_domain/entities";
import ProductFilters from "./components/ProductFilters";
import ProductGrid from "./components/ProductGrid";
import { useProductCatalog } from "./hooks/useProductCatalog";

export default function ProductCatalogView() {
  const { filter, updateFilter, products, isLoading, filterOptions, errorMessage } = useProductCatalog();
  const cart = useCart();

  function handleSelect(product: Product, saleType: SaleType) {
    const productId = Number(product.id);
    const price =
      saleType === "sell"
        ? product.sellPrice
        : saleType === "exchange"
          ? product.exchangePrice
          : product.refillPrice;

    cart.addItem({
      id: `tank:${product.id}:${saleType}`,
      productId,
      source: "tank",
      name: `${product.brandLabel} ${product.weightKg}กก.`,
      price,
      saleType,
    });
  }

  return (
    <>
      <ProductFilters filter={filter} options={filterOptions} onChange={updateFilter} />
      {errorMessage && (
        <Alert severity="error" sx={{ mx: { xs: 2, md: 3 }, mb: 2 }}>
          {errorMessage}
        </Alert>
      )}
      <ProductGrid products={products} isLoading={isLoading} onSelect={handleSelect} />
    </>
  );
}
