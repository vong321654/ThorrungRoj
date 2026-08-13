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

export async function uploadWebpImage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  image: Buffer,
) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, image, { contentType: "image/webp", upsert: false });
  return error;
}

export function storagePathFromUrl(value: string | null, bucket: string) {
  if (!value) return null;
  const marker = `/${bucket}/`;
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : null;
}
