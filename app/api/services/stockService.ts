import "server-only";

import { createAdminClient } from "@/app/api/util/supabase/admin";

// ออเดอร์ที่ยังไม่ส่ง ของยังอยู่ในคลังแต่ถูกลูกค้าซื้อไปแล้ว ต้องหักออกจากจำนวนที่สั่งได้
// (ระบบยังไม่ได้ใช้ quantityReserved จองสต๊อกตอนสั่งซื้อ จึงนับจากออเดอร์แทน)
const OPEN_ORDER_STATUSES = ["pending", "preparing", "delivering"];

/**
 * จำนวนถังเต็มที่ลูกค้ายังสั่งได้ต่อ productId
 * = ผลรวม (quantityOnHand - quantityReserved) ของแถว stockStatus "full"
 *   - จำนวนในออเดอร์ที่ยังไม่ส่ง
 * สินค้าที่ไม่มีแถวในคลังถือว่าคงเหลือ 0
 *
 * ใช้ service-role client เพราะต้องรวมออเดอร์ของลูกค้าทุกคน ซึ่ง RLS ไม่ให้ลูกค้าเห็น
 * ฟังก์ชันนี้คืนแค่ตัวเลขรวม ไม่ส่งข้อมูลออเดอร์ของคนอื่นออกไป
 */
export async function getOrderableStock(productIds?: number[]) {
  const supabase = createAdminClient();

  let inventoryQuery = supabase
    .from("inventoryProducts")
    .select("productId, quantityOnHand, quantityReserved")
    .eq("stockStatus", "full");
  let openOrderQuery = supabase
    .from("orderItems")
    .select("productId, quantity, orders!inner(status)")
    .in("orders.status", OPEN_ORDER_STATUSES);
  if (productIds) {
    inventoryQuery = inventoryQuery.in("productId", productIds);
    openOrderQuery = openOrderQuery.in("productId", productIds);
  }

  const [inventory, openOrders] = await Promise.all([inventoryQuery, openOrderQuery]);
  if (inventory.error || openOrders.error) return null;

  const stock = new Map<number, number>();
  for (const row of inventory.data) {
    const productId = Number(row.productId);
    const available = Number(row.quantityOnHand) - Number(row.quantityReserved);
    stock.set(productId, (stock.get(productId) ?? 0) + available);
  }
  for (const item of openOrders.data) {
    const productId = Number(item.productId);
    stock.set(productId, (stock.get(productId) ?? 0) - Number(item.quantity));
  }
  for (const [productId, quantity] of stock) {
    stock.set(productId, Math.max(0, quantity));
  }
  return stock;
}
