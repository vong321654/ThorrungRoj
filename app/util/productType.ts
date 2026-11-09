// ระบุถังแก๊สจาก "ชื่อ" ประเภทสินค้า ไม่ใช่ id
// เพราะ id ใน productsType เปลี่ยนทุกครั้งที่ลบแล้วสร้างประเภทใหม่ (เคยฝังเลข 14 ไว้แล้วสินค้าหายหมด)
// สินค้าที่ไม่ใช่ถังแก๊สถือเป็นอะไหล่/อุปกรณ์ทั้งหมด จะตั้งชื่อประเภทอะไหล่ว่าอะไรก็ได้
export const GAS_CYLINDER_TYPE_NAME = "ถังแก๊ส";

// ใส่ใน select ของ Supabase เพื่อดึงชื่อประเภทมากับสินค้า เช่น .select(`id, typeId, ${PRODUCT_TYPE_EMBED}`)
export const PRODUCT_TYPE_EMBED = "productsType(name)";

// PostgREST ส่ง object ตัวเดียว แต่ type ที่ supabase-js เดาให้เป็น array จึงรับได้ทั้งสองแบบ
export type ProductTypeEmbed ={ name: string | null } | { name: string | null }[] | null | undefined;

export function isGasCylinderType(productsType: ProductTypeEmbed) {
  const type = Array.isArray(productsType) ? productsType[0] : productsType;
  return type?.name?.trim() === GAS_CYLINDER_TYPE_NAME;
}

export function isGasCylinderProduct(product: { productsType?: ProductTypeEmbed } | null | undefined) {
  return isGasCylinderType(product?.productsType);
}
