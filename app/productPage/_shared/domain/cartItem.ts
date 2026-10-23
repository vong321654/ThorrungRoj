export type CartItemSource = "tank" | "part";
export type SaleType = "sell" | "exchange" | "refill";

export type CartItem = {
  id: string;
  productId: number | null;
  source: CartItemSource;
  name: string;
  price: number | null;
  saleType: SaleType | null;
  // จำนวนคงเหลือตอนหยิบใส่ตะกร้า ใช้กันกดเพิ่มเกินสต๊อกฝั่ง client
  // (server ตรวจซ้ำอีกครั้งตอนสั่งซื้อ เพราะตัวเลขนี้อาจเก่าแล้ว)
  stockLimit?: number;
};

export type CartLine = {
  item: CartItem;
  quantity: number;
};
