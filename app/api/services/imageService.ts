import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const RECEIPT_IMAGE_BUCKET = "payment-receipts";

export async function convertImageToWebp(file: File) {
  try {
    return await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 })
      .rotate()
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  } catch {
    return null;
  }
}

// รูปประกาศถูกส่งเข้า LINE เป็นรูปในการ์ด Flex Message ซึ่งรับเฉพาะ JPEG/PNG (WebP แสดงเป็นรูปแตก)
// จึงแปลงเป็น JPEG แทน WebP ปูพื้นขาวให้ PNG โปร่งใส และย่อด้านยาวไม่เกิน 1600px ให้ลูกค้าโหลดเร็ว
export async function convertImageToJpeg(file: File) {
  return convertBufferToJpeg(Buffer.from(await file.arrayBuffer()));
}

// สลิปที่ลูกค้าส่งในแชท LINE ก็เก็บเป็น JPEG ด้วยเหตุผลเดียวกัน เพราะรูปจะถูกแสดงในการ์ดแจ้งแอดมิน
export async function convertBufferToJpeg(input: Buffer) {
  try {
    return await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

export async function uploadImage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  image: Buffer,
  contentType: "image/webp" | "image/jpeg",
) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, image, { contentType, upsert: false });
  return error;
}

export function uploadWebpImage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  image: Buffer,
) {
  return uploadImage(supabase, bucket, path, image, "image/webp");
}

export function storagePathFromUrl(value: string | null, bucket: string) {
  if (!value) return null;
  const marker = `/${bucket}/`;
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : null;
}
