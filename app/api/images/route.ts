import { apiError, apiSuccess } from "@/app/api/response";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateAdmin } from "../admin/authorization";

const PRODUCT_BUCKET = "product-images";
const RECEIPT_BUCKET = "payment-receipts";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
type ImageKind = "product" | "receipt";

function parsePositiveId(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseUuid(value: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function extensionFor(file: File) {
  switch (file.type) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    default: return null;
  }
}

function validateFile(value: FormDataEntryValue | null): File | Response {
  if (!(value instanceof File) || value.size === 0) {
    return Response.json(apiError("An image file is required"), { status: 400 });
  }
  if (!IMAGE_TYPES.has(value.type) || value.size > MAX_FILE_SIZE) {
    return Response.json(apiError("Image must be a JPEG, PNG, or WebP file no larger than 5 MB"), { status: 400 });
  }
  return value;
}

function getKind(value: string | null): ImageKind | null {
  return value === "product" || value === "receipt" ? value : null;
}

function storagePathFromUrl(value: string | null, bucket: string) {
  if (!value) return null;
  const marker = `/${bucket}/`;
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : null;
}

async function saveFile(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File,
) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  return error;
}

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const kind = getKind(params.get("type"));
  if (!kind) return Response.json(apiError("type must be product or receipt"), { status: 400 });

  if (kind === "product") {
    const productId = parsePositiveId(params.get("productId"));
    if (!productId) return Response.json(apiError("A valid productId is required"), { status: 400 });
    const { data, error } = await auth.supabase
      .from("products")
      .select("id, imageUrl")
      .eq("id", productId)
      .maybeSingle();
    if (error) return Response.json(apiError("Failed to fetch product image"), { status: 500 });
    if (!data) return Response.json(apiError("Product not found"), { status: 404 });
    return Response.json(apiSuccess("Product image retrieved successfully", data));
  }

  const slipId = parseUuid(params.get("slipId"));
  if (!slipId) return Response.json(apiError("A valid slipId is required"), { status: 400 });
  const { data: slip, error } = await auth.supabase
    .from("transferSlips")
    .select("id, paymentId, userId, slipImageUrl, status, createdAt")
    .eq("id", slipId)
    .maybeSingle();
  if (error) return Response.json(apiError("Failed to fetch receipt image"), { status: 500 });
  if (!slip) return Response.json(apiError("Receipt not found"), { status: 404 });

  const path = storagePathFromUrl(slip.slipImageUrl, RECEIPT_BUCKET) ?? slip.slipImageUrl;
  const { data: signed, error: signError } = await auth.supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (signError || !signed) return Response.json(apiError("Failed to create receipt URL"), { status: 500 });
  return Response.json(apiSuccess("Receipt image retrieved successfully", { ...slip, url: signed.signedUrl }));
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json(apiError("Request must use multipart/form-data"), { status: 400 });
  const kind = getKind(typeof form.get("type") === "string" ? form.get("type") as string : null);
  const file = validateFile(form.get("file"));
  if (!kind) return Response.json(apiError("type must be product or receipt"), { status: 400 });
  if (file instanceof Response) return file;
  const extension = extensionFor(file)!;

  if (kind === "product") {
    const productId = parsePositiveId(typeof form.get("productId") === "string" ? form.get("productId") as string : null);
    if (!productId) return Response.json(apiError("A valid productId is required"), { status: 400 });
    const { data: product, error: productError } = await auth.supabase
      .from("products").select("id").eq("id", productId).maybeSingle();
    if (productError) return Response.json(apiError("Failed to validate product"), { status: 500 });
    if (!product) return Response.json(apiError("Product not found"), { status: 404 });

    const path = `products/${productId}/${crypto.randomUUID()}.${extension}`;
    const uploadError = await saveFile(auth.supabase, PRODUCT_BUCKET, path, file);
    if (uploadError) return Response.json(apiError("Failed to upload product image"), { status: 500 });
    const { data: urlData } = auth.supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path);
    const { data, error } = await auth.supabase
      .from("products")
      .update({ imageUrl: urlData.publicUrl, updatedBy: auth.admin.id, updatedAt: new Date().toISOString() })
      .eq("id", productId).select("id, imageUrl").single();
    if (error) {
      await auth.supabase.storage.from(PRODUCT_BUCKET).remove([path]);
      return Response.json(apiError("Failed to save product image"), { status: 500 });
    }
    return Response.json(apiSuccess("Product image uploaded successfully", data), { status: 201 });
  }

  const paymentId = parseUuid(typeof form.get("paymentId") === "string" ? form.get("paymentId") as string : null);
  if (!paymentId) return Response.json(apiError("A valid paymentId is required"), { status: 400 });
  const { data: payment, error: paymentError } = await auth.supabase
    .from("payments").select("id, orders!inner(userId)").eq("id", paymentId).maybeSingle();
  if (paymentError) return Response.json(apiError("Failed to validate payment"), { status: 500 });
  if (!payment) return Response.json(apiError("Payment not found"), { status: 404 });

  const path = `receipts/${paymentId}/${crypto.randomUUID()}.${extension}`;
  const uploadError = await saveFile(auth.supabase, RECEIPT_BUCKET, path, file);
  if (uploadError) return Response.json(apiError("Failed to upload receipt image"), { status: 500 });
  const order = Array.isArray(payment.orders) ? payment.orders[0] : payment.orders;
  const userId = (order as { userId?: string } | null)?.userId;
  if (!userId) {
    await auth.supabase.storage.from(RECEIPT_BUCKET).remove([path]);
    return Response.json(apiError("Payment order was not found"), { status: 400 });
  }
  const { data, error } = await auth.supabase
    .from("transferSlips")
    .insert({ paymentId, userId, slipImageUrl: path })
    .select("id, paymentId, userId, slipImageUrl, status, createdAt")
    .single();
  if (error) {
    await auth.supabase.storage.from(RECEIPT_BUCKET).remove([path]);
    return Response.json(apiError("Failed to save receipt image"), { status: 500 });
  }
  return Response.json(apiSuccess("Receipt image uploaded successfully", data), { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json(apiError("Request must use multipart/form-data"), { status: 400 });
  const kind = getKind(typeof form.get("type") === "string" ? form.get("type") as string : null);
  const file = validateFile(form.get("file"));
  if (!kind) return Response.json(apiError("type must be product or receipt"), { status: 400 });
  if (file instanceof Response) return file;
  const extension = extensionFor(file)!;

  const isProduct = kind === "product";
  const id = isProduct
    ? parsePositiveId(typeof form.get("productId") === "string" ? form.get("productId") as string : null)
    : parseUuid(typeof form.get("slipId") === "string" ? form.get("slipId") as string : null);
  if (!id) return Response.json(apiError(isProduct ? "A valid productId is required" : "A valid slipId is required"), { status: 400 });

  const table = isProduct ? "products" : "transferSlips";
  const imageField = isProduct ? "imageUrl" : "slipImageUrl";
  const { data: current, error: currentError } = await auth.supabase
    .from(table).select(`id, ${imageField}`).eq("id", id).maybeSingle();
  if (currentError) return Response.json(apiError("Failed to load current image"), { status: 500 });
  if (!current) return Response.json(apiError(isProduct ? "Product not found" : "Receipt not found"), { status: 404 });

  const bucket = isProduct ? PRODUCT_BUCKET : RECEIPT_BUCKET;
  const path = `${isProduct ? "products" : "receipts"}/${id}/${crypto.randomUUID()}.${extension}`;
  const uploadError = await saveFile(auth.supabase, bucket, path, file);
  if (uploadError) return Response.json(apiError("Failed to upload image"), { status: 500 });
  const imageValue = isProduct
    ? auth.supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path).data.publicUrl
    : path;
  const updates = isProduct
    ? { imageUrl: imageValue, updatedBy: auth.admin.id, updatedAt: new Date().toISOString() }
    : { slipImageUrl: imageValue };
  const { data, error } = await auth.supabase.from(table).update(updates).eq("id", id).select().single();
  if (error) {
    await auth.supabase.storage.from(bucket).remove([path]);
    return Response.json(apiError("Failed to update image"), { status: 500 });
  }
  const currentImage = isProduct
    ? ("imageUrl" in current ? current.imageUrl : null)
    : ("slipImageUrl" in current ? current.slipImageUrl : null);
  const previousPath = storagePathFromUrl(currentImage, bucket) ?? (!isProduct ? currentImage : null);
  if (previousPath) await auth.supabase.storage.from(bucket).remove([previousPath]);
  return Response.json(apiSuccess("Image updated successfully", data));
}
