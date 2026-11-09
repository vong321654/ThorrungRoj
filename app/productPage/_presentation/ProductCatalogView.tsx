"use client";

import Alert from "@mui/material/Alert";
import { useCart } from "@/app/productPage/_shared/CartContext";
import type { SaleType } from "@/app/productPage/_shared/domain/cartItem";
import type { Product } from "@/app/productPage/_domain/entities";
import ProductFilters from "./components/ProductFilters";
import ProductGrid from "./components/ProductGrid";
import { getSaleTypePrices } from "./productPricing";
import { useProductCatalog } from "./hooks/useProductCatalog";

export default function ProductCatalogView() {
  const { filter, updateFilter, products, isLoading, filterOptions, errorMessage } = useProductCatalog();
  const cart = useCart();

  function handleSelect(product: Product, saleType: SaleType) {
    const productId = Number(product.id);
    const { price, shopPrice } = getSaleTypePrices(product, saleType);

    cart.addItem({
      id: `tank:${product.id}:${saleType}`,
      productId,
      source: "tank",
      name: `${product.brandLabel} ${product.weightKg}กก.`,
      price,
      shopPrice: shopPrice > 0 ? shopPrice : null,
      saleType,
      // null = ไม่จำกัดตามสต๊อก เพราะฝากเติมใช้ถังของลูกค้า
      availableQuantity: saleType === "refill" ? null : product.availableQuantity ?? 0,
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
