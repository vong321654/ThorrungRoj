import { apiError, apiSuccess } from "@/app/api/response";
import {
  convertImageToWebp,
  PRODUCT_IMAGE_BUCKET,
  RECEIPT_IMAGE_BUCKET,
  storagePathFromUrl,
  uploadWebpImage,
} from "@/app/api/services/imageService";
import {
  createAuthenticatedClient,
  getBearerToken,
} from "@/app/api/util/supabase/authenticated";
import type { AUTHIDENTITYUSER, IMAGEKIND, PAYMENTORDEROWNER } from "@/app/models/image";
import { IMAGEKIND as IMAGEKINDENUM } from "@/app/enums/image";
import { authenticateAdmin } from "../admin/authorization";
import { isAdminOrSuperAdmin, isSuperAdmin } from "../services/adminService";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

function validateFile(value: FormDataEntryValue | null): File | Response {
  if (!(value instanceof File) || value.size === 0) {
    return Response.json(apiError("An image file is required"), { status: 400 });
  }
  if (!IMAGE_TYPES.has(value.type) || value.size > MAX_FILE_SIZE) {
    return Response.json(apiError("Image must be a JPEG, PNG, or WebP file no larger than 5 MB"), { status: 400 });
  }
  return value;
}

function getKind(value: string | null): IMAGEKIND | null {
  return Object.values(IMAGEKINDENUM).includes(value as IMAGEKINDENUM) ? value as IMAGEKINDENUM : null;
}

function isLineUser(user: AUTHIDENTITYUSER) {
  return user.app_metadata?.provider === "line" ||
    user.app_metadata?.provider === "custom:line-liff" ||
    user.identities?.some((identity) => identity.provider === "line" || identity.provider === "custom:line-liff") === true;
}

async function authenticateReceiptUploader(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) return Response.json(apiError("Missing access token"), { status: 401 });

  const supabase = createAuthenticatedClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user || !isLineUser(authData.user)) {
    return Response.json(apiError("Please sign in with LINE to upload a receipt"), { status: 403 });
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, isActive")
    .eq("authId", authData.user.id)
    .maybeSingle();
  if (error) return Response.json(apiError("Failed to load customer profile"), { status: 500 });
  if (!user || !user.isActive) return Response.json(apiError("Customer account is inactive"), { status: 403 });
  return { supabase, userId: user.id };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = getKind(params.get("type"));
  if (!kind) return Response.json(apiError("type must be product or receipt"), { status: 400 });

  if (kind === IMAGEKINDENUM.PRODUCT) {
    const auth = await authenticateAdmin(request);
    if (auth instanceof Response) return auth;
    if (!isAdminOrSuperAdmin(auth)) return Response.json(apiError("Only admins can manage product images"), { status: 403 });
    const productId = parsePositiveId(params.get("productId"));
    if (!productId) return Response.json(apiError("A valid productId is required"), { status: 400 });
    const { data, error } = await auth.adminSupabase
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
  const adminAuth = await authenticateAdmin(request);
  if (!(adminAuth instanceof Response) && !isAdminOrSuperAdmin(adminAuth)) {
    return Response.json(apiError("Only admins can view receipt images"), { status: 403 });
  }
  const customerAuth = adminAuth instanceof Response ? await authenticateReceiptUploader(request) : null;
  if (customerAuth instanceof Response) return customerAuth;
  const adminSupabase = adminAuth instanceof Response
    ? customerAuth!.supabase
    : adminAuth.adminSupabase;
  const customerId = adminAuth instanceof Response ? customerAuth!.userId : null;

  let query = adminSupabase
    .from("transferSlips")
    .select("id, paymentId, userId, slipImageUrl, status, createdAt")
    .eq("id", slipId);
  if (customerId) query = query.eq("userId", customerId);
  const { data: slip, error } = await query.maybeSingle();
  if (error) return Response.json(apiError("Failed to fetch receipt image"), { status: 500 });
  if (!slip) return Response.json(apiError("Receipt not found or you do not have access"), { status: 404 });

  const path = storagePathFromUrl(slip.slipImageUrl, RECEIPT_IMAGE_BUCKET) ?? slip.slipImageUrl;
  const { data: signed, error: signError } = await adminSupabase.storage
    .from(RECEIPT_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (signError || !signed) return Response.json(apiError("Failed to create receipt URL"), { status: 500 });
  return Response.json(apiSuccess("Receipt image retrieved successfully", { ...slip, url: signed.signedUrl }));
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json(apiError("Request must use multipart/form-data"), { status: 400 });
  const kind = getKind(typeof form.get("type") === "string" ? form.get("type") as string : null);
  const file = validateFile(form.get("file"));
  if (!kind) return Response.json(apiError("type must be product or receipt"), { status: 400 });
  if (file instanceof Response) return file;
  const webpImage = await convertImageToWebp(file);
  if (!webpImage) return Response.json(apiError("The selected file is not a valid image"), { status: 400 });

  // อัปโหลดรูปสินค้าแล้วคืน imageUrl ให้ client เท่านั้น
  // การบันทึกลง DB เกิดตอน add/updateProduct โดยส่ง imageUrl ไปพร้อมข้อมูลสินค้า
  if (kind === IMAGEKINDENUM.PRODUCT) {
    const auth = await authenticateAdmin(request);
    if (auth instanceof Response) return auth;
    if (!isSuperAdmin(auth)) {
      return Response.json(apiError("Only a super admin can upload product images"), { status: 403 });
    }

    const path = `products/${crypto.randomUUID()}.webp`;
    const uploadError = await uploadWebpImage(auth.adminSupabase, PRODUCT_IMAGE_BUCKET, path, webpImage);
    if (uploadError) return Response.json(apiError("Failed to upload product image"), { status: 500 });
    const { data: urlData } = auth.adminSupabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
    return Response.json(
      apiSuccess("Product image uploaded successfully", { imageUrl: urlData.publicUrl }),
      { status: 201 },
    );
  }

  const adminAuth = await authenticateAdmin(request);
  if (!(adminAuth instanceof Response) && !isAdminOrSuperAdmin(adminAuth)) {
    return Response.json(apiError("Only admins can manage receipt images"), { status: 403 });
  }
  const customerAuth = adminAuth instanceof Response ? await authenticateReceiptUploader(request) : null;
  if (customerAuth instanceof Response) return customerAuth;
  const adminSupabase = adminAuth instanceof Response
    ? customerAuth!.supabase
    : adminAuth.adminSupabase;
  const customerId = adminAuth instanceof Response ? customerAuth!.userId : null;

  const paymentId = parseUuid(typeof form.get("paymentId") === "string" ? form.get("paymentId") as string : null);
  if (!paymentId) return Response.json(apiError("A valid paymentId is required"), { status: 400 });
  const { data: payment, error: paymentError } = await adminSupabase
    .from("payments").select("id, orders!inner(userId)").eq("id", paymentId).maybeSingle();
  if (paymentError) return Response.json(apiError("Failed to validate payment"), { status: 500 });
  if (!payment) return Response.json(apiError("Payment not found"), { status: 404 });

  const order = Array.isArray(payment.orders) ? payment.orders[0] : payment.orders;
  const userId = (order as PAYMENTORDEROWNER)?.userId;
  if (!userId) {
    return Response.json(apiError("Payment order was not found"), { status: 400 });
  }
  if (customerId && userId !== customerId) {
    return Response.json(apiError("You cannot upload a receipt for another customer"), { status: 403 });
  }

  const path = `receipts/${userId}/${paymentId}/${crypto.randomUUID()}.webp`;
  const uploadError = await uploadWebpImage(adminSupabase, RECEIPT_IMAGE_BUCKET, path, webpImage);
  if (uploadError) return Response.json(apiError(`Failed to upload receipt image: ${uploadError.message}`), { status: 500 });
  const { data, error } = await adminSupabase
    .from("transferSlips")
    .insert({ paymentId, userId, slipImageUrl: path })
    .select("id, paymentId, userId, slipImageUrl, status, createdAt")
    .single();
  if (error) {
    await adminSupabase.storage.from(RECEIPT_IMAGE_BUCKET).remove([path]);
    return Response.json(apiError("Failed to save receipt image"), { status: 500 });
  }
  return Response.json(apiSuccess("Receipt image uploaded successfully", data), { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdminOrSuperAdmin(auth)) return Response.json(apiError("Only admins can update images"), { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json(apiError("Request must use multipart/form-data"), { status: 400 });
  const kind = getKind(typeof form.get("type") === "string" ? form.get("type") as string : null);
  const file = validateFile(form.get("file"));
  // รูปสินค้าไม่ใช้ PATCH แล้ว — อัปโหลดด้วย POST แล้วส่ง imageUrl ไปกับ add/updateProduct
  if (kind !== IMAGEKINDENUM.RECEIPT) {
    return Response.json(apiError("type must be receipt"), { status: 400 });
  }
  if (file instanceof Response) return file;
  const webpImage = await convertImageToWebp(file);
  if (!webpImage) return Response.json(apiError("The selected file is not a valid image"), { status: 400 });

  const slipId = parseUuid(typeof form.get("slipId") === "string" ? form.get("slipId") as string : null);
  if (!slipId) return Response.json(apiError("A valid slipId is required"), { status: 400 });

  const { data: current, error: currentError } = await auth.adminSupabase
    .from("transferSlips").select("id, slipImageUrl").eq("id", slipId).maybeSingle();
  if (currentError) return Response.json(apiError("Failed to load current image"), { status: 500 });
  if (!current) return Response.json(apiError("Receipt not found"), { status: 404 });

  const path = `receipts/${slipId}/${crypto.randomUUID()}.webp`;
  const uploadError = await uploadWebpImage(auth.adminSupabase, RECEIPT_IMAGE_BUCKET, path, webpImage);
  if (uploadError) return Response.json(apiError("Failed to upload image"), { status: 500 });
  const { data, error } = await auth.adminSupabase
    .from("transferSlips").update({ slipImageUrl: path }).eq("id", slipId).select().single();
  if (error) {
    await auth.adminSupabase.storage.from(RECEIPT_IMAGE_BUCKET).remove([path]);
    return Response.json(apiError("Failed to update image"), { status: 500 });
  }
  const previousPath = storagePathFromUrl(current.slipImageUrl, RECEIPT_IMAGE_BUCKET) ?? current.slipImageUrl;
  if (previousPath) await auth.adminSupabase.storage.from(RECEIPT_IMAGE_BUCKET).remove([previousPath]);
  return Response.json(apiSuccess("Image updated successfully", data));
}
