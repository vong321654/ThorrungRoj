export type CartItemSource = "tank" | "part";
export type SaleType = "sell" | "exchange" | "refill";

export type CartItem = {
  id: string;
  productId: number | null;
  source: CartItemSource;
  name: string;
  price: number | null;
  saleType: SaleType | null;
};

export type CartLine = {
  item: CartItem;
  quantity: number;
};
