import type { Product } from "@/app/productPage/_domain/entities";
import type { SaleType } from "@/app/productPage/_shared/domain/cartItem";
import type { CUSTOMERTYPE } from "@/app/enums/customer";
import { resolveTierPrice } from "@/app/util/customerPricing";

// ราคาปกติกับราคาร้านค้าของแต่ละรูปแบบการซื้อ ซื้อถังไม่มีราคาร้านค้า
export function getSaleTypePrices(product: Product, saleType: SaleType) {
  if (saleType === "exchange") return { price: product.exchangePrice, shopPrice: product.shopExchangePrice };
  if (saleType === "refill") return { price: product.refillPrice, shopPrice: product.shopRefillPrice };
  return { price: product.sellPrice, shopPrice: 0 };
}

export function getDisplayPrice(product: Product, saleType: SaleType, customerType: CUSTOMERTYPE) {
  const { price, shopPrice } = getSaleTypePrices(product, saleType);
  return resolveTierPrice(price, shopPrice, customerType);
}
