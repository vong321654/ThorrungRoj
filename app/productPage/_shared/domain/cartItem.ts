export type CartItemSource = "tank" | "part";
export type SaleType = "sell" | "exchange" | "refill";

export type CartItem = {
  id: string;
  productId: number | null;
  source: CartItemSource;
  name: string;
  // ราคาปกติ (บ้านทั่วไป)
  price: number | null;
  // ราคาร้านค้า null = ไม่มีราคาร้านค้า ใช้ราคาปกติ ตะกร้าเลือกราคาที่แสดงตามประเภทลูกค้า
  shopPrice: number | null;
  saleType: SaleType | null;
  availableQuantity: number | null;
};

export type CartLine = {
  item: CartItem;
  quantity: number;
};
