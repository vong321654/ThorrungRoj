import { CUSTOMERTYPE } from "@/app/enums/customer";

/**
 * ราคาที่ลูกค้าแต่ละประเภทต้องจ่าย ใช้ร่วมกันทั้งหน้าร้านและ server ตอนสร้างออเดอร์
 * ร้านค้าได้ราคาร้านค้าเฉพาะสินค้าที่ตั้งราคาร้านค้าไว้ (มากกว่า 0) นอกนั้นใช้ราคาปกติ
 */
export function resolveTierPrice(
  normalPrice: number,
  shopPrice: number | null | undefined,
  customerType: CUSTOMERTYPE,
) {
  if (customerType === CUSTOMERTYPE.SHOP && typeof shopPrice === "number" && Number.isFinite(shopPrice) && shopPrice > 0) {
    return shopPrice;
  }
  return normalPrice;
}

// ค่าที่ไม่ใช่ "shop" (รวมค่าที่อ่านไม่ได้) ถือเป็นบ้านทั่วไป เพื่อไม่ให้ได้ราคาร้านค้าโดยไม่ตั้งใจ
export function toCustomerType(value: unknown): CUSTOMERTYPE {
  return value === CUSTOMERTYPE.SHOP ? CUSTOMERTYPE.SHOP : CUSTOMERTYPE.INDIVIDUAL;
}
