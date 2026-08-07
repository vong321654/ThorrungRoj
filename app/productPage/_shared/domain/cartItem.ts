export type CartItemSource = "tank" | "part";

export type CartItem = {
  id: string;
  source: CartItemSource;
  name: string;
  price: number | null;
};

export type CartLine = {
  item: CartItem;
  quantity: number;
};