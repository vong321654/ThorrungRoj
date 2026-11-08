import type { User as AuthUser } from "@supabase/supabase-js";
import { createAuthenticatedClient } from "@/app/api/util/supabase/authenticated";
import { apiError, apiSuccess } from "@/app/api/response";
import type { SERVICERESULT } from "@/app/models/api";
import type {
  CHECKOUTITEMINPUT,
  CHECKOUTPAYLOAD,
  CUSTOMERORDERPROFILE,
  ORDERPAYMENTRECORD,
  ORDERRECORD,
  PRODUCTPRICINGROW,
} from "@/app/models/order";
import type { SaleType } from "@/app/productPage/_shared/domain/cartItem";
import { PAYMENTMETHOD, SALETYPE } from "@/app/enums/order";
import { TANK_TYPE_ID } from "./debtService";
import { notifyOrderCreated } from "./orderNotifyService";
import { buildPromptPayQrPath } from "./promptPayService";
import { getOrderableStock } from "./stockService";
import { parseDeliveryLocation, toDeliveryLocation } from "@/app/util/deliveryLocation";

const SALE_TYPES = new Set<SaleType>([SALETYPE.SELL, SALETYPE.EXCHANGE, SALETYPE.REFILL]);
// ค้างชำระ/ค้างถัง ไม่สร้างรายการชำระเงิน แอดมินจะบันทึกหนี้ในหน้า "หนี้ค้าง" หลังจัดส่งแล้ว
const PAYMENT_METHODS = new Set<PAYMENTMETHOD>([
  PAYMENTMETHOD.CASH,
  PAYMENTMETHOD.QR_SCAN,
  PAYMENTMETHOD.PENDING_PAYMENT,
  PAYMENTMETHOD.PENDING_CART,
  PAYMENTMETHOD.PENDING_BOTH,
]);

function failure<T>(message: string, status: number): SERVICERESULT<T> {
  return { result: apiError(message), status };
}

function isLineUser(user: AuthUser) {
  return (
    user.app_metadata?.provider === "line" ||
    user.app_metadata?.provider === "custom:line-liff" ||
    user.identities?.some(
      (identity) => identity.provider === "line" || identity.provider === "custom:line-liff",
    ) === true
  );
}

async function authenticateCustomer(accessToken: string | null) {
  if (!accessToken) return failure<CUSTOMERORDERPROFILE>("Missing access token", 401);

  const authenticatedSupabase = createAuthenticatedClient(accessToken);
  const { data: authData, error: authError } = await authenticatedSupabase.auth.getUser(accessToken);
  if (authError || !authData.user) return failure<CUSTOMERORDERPROFILE>("Invalid session", 401);
  if (!isLineUser(authData.user)) {
    return failure<CUSTOMERORDERPROFILE>("Please sign in with LINE to place an order", 403);
  }

  const { data: customer, error } = await authenticatedSupabase
    .from("users")
    .select("id, address, isActive")
    .eq("authId", authData.user.id)
    .maybeSingle();

  if (error) return failure<CUSTOMERORDERPROFILE>("Failed to load customer data", 500);
  if (!customer) return failure<CUSTOMERORDERPROFILE>("Customer profile was not found", 403);
  if (!customer.isActive) return failure<CUSTOMERORDERPROFILE>("Customer account is inactive", 403);

  return {
    result: apiSuccess("Customer authenticated", customer as CUSTOMERORDERPROFILE),
    status: 200,
  };
}

type PARSEDCHECKOUT = { ok: true; payload: CHECKOUTPAYLOAD } | { ok: false; message: string };

function parseCheckoutPayload(value: unknown): PARSEDCHECKOUT {
  const payload = parseCheckoutBody(value);
  if (!payload) return { ok: false, message: "Invalid checkout payload" };
  const raw = value as { deliveryLat?: unknown; deliveryLng?: unknown };
  const location = parseDeliveryLocation(raw.deliveryLat, raw.deliveryLng);
  if (!location.ok) return { ok: false, message: location.message };
  return {
    ok: true,
    payload: { ...payload, deliveryLat: location.location?.lat ?? null, deliveryLng: location.location?.lng ?? null },
  };
}

function parseCheckoutBody(value: unknown): CHECKOUTPAYLOAD | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<CHECKOUTPAYLOAD>;
  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 50) {
    return null;
  }
  if (typeof payload.paymentMethod !== "string" || !PAYMENT_METHODS.has(payload.paymentMethod)) {
    return null;
  }

  const items: CHECKOUTITEMINPUT[] = [];
  for (const item of payload.items) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Partial<CHECKOUTITEMINPUT>;
    if (
      !Number.isInteger(candidate.productId) ||
      (candidate.productId ?? 0) <= 0 ||
      !Number.isInteger(candidate.quantity) ||
      (candidate.quantity ?? 0) <= 0 ||
      (candidate.quantity ?? 0) > 100 ||
      typeof candidate.saleType !== "string" ||
      !SALE_TYPES.has(candidate.saleType as SaleType)
    ) {
      return null;
    }
    items.push(candidate as CHECKOUTITEMINPUT);
  }

  return {
    items,
    paymentMethod: payload.paymentMethod as PAYMENTMETHOD,
    ...(typeof payload.deliveryAddress === "string"
      ? { deliveryAddress: payload.deliveryAddress.trim() }
      : {}),
    ...(typeof payload.note === "string" ? { note: payload.note.trim() } : {}),
  };
}

// numeric จาก PostgREST อาจมาเป็นสตริง แปลงให้เป็นตัวเลขหรือ null ก่อนส่งให้หน้าเว็บ
function coordinateFields(row: { deliveryLat?: unknown; deliveryLng?: unknown }) {
  const location = toDeliveryLocation(row.deliveryLat, row.deliveryLng);
  return { deliveryLat: location?.lat ?? null, deliveryLng: location?.lng ?? null };
}

function getUnitPrice(product: PRODUCTPRICINGROW, saleType: SaleType) {
  if (saleType === "exchange") return Number(product.exchangePrice);
  if (saleType === "refill") return Number(product.refillPrice);
  return Number(product.sellPrice);
}

export async function createOrder(
  accessToken: string | null,
  rawPayload: unknown,
): Promise<SERVICERESULT<ORDERRECORD>> {
  const auth = await authenticateCustomer(accessToken);
  if (auth.result.status === "error") {
    return failure<ORDERRECORD>(auth.result.message, auth.status);
  }

  const parsed = parseCheckoutPayload(rawPayload);
  if (!parsed.ok) return failure<ORDERRECORD>(parsed.message, 400);
  const payload = parsed.payload;

  const combinedItems = new Map<string, CHECKOUTITEMINPUT>();
  for (const item of payload.items) {
    const key = `${item.productId}:${item.saleType}`;
    const current = combinedItems.get(key);
    const quantity = (current?.quantity ?? 0) + item.quantity;
    if (quantity > 100) return failure<ORDERRECORD>("Product quantity is too large", 400);
    combinedItems.set(key, { ...item, quantity });
  }

  const items = [...combinedItems.values()];
  const productIds = [...new Set(items.map((item) => item.productId))];
  const supabase = createAuthenticatedClient(accessToken!);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, sellPrice, exchangePrice, refillPrice, isActive, typeId")
    .in("id", productIds);

  if (productsError) return failure<ORDERRECORD>("Failed to validate products", 500);
  if (!products || products.length !== productIds.length) {
    return failure<ORDERRECORD>("One or more products were not found", 400);
  }

  const productsById = new Map(
    (products as PRODUCTPRICINGROW[]).map((product) => [Number(product.id), product]),
  );
  const orderItems = items.map((item) => {
    const product = productsById.get(item.productId);
    if (!product || !product.isActive) return null;
    const unitPrice = getUnitPrice(product, item.saleType);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
    return {
      productId: item.productId,
      productNameSnapshot: product.name,
      quantity: item.quantity,
      unitPrice,
      saleType: item.saleType,
    };
  });

  if (orderItems.some((item) => item === null)) {
    return failure<ORDERRECORD>("A product is inactive or has no price for the selected sale type", 400);
  }

  const validOrderItems = orderItems.filter((item) => item !== null);

  // ค้างถังต้องมีรายการเปลี่ยนถังในออเดอร์ ไม่งั้นตอนส่งของจะไม่มีอะไรให้บันทึกหนี้
  if (
    (payload.paymentMethod === PAYMENTMETHOD.PENDING_CART || payload.paymentMethod === PAYMENTMETHOD.PENDING_BOTH) &&
    !validOrderItems.some(
      (item) => item.saleType === "exchange" && Number(productsById.get(item.productId)?.typeId) === TANK_TYPE_ID,
    )
  ) {
    return failure<ORDERRECORD>("เลือกค้างถังได้เฉพาะออเดอร์ที่มีรายการเปลี่ยนถัง กรุณาเลือกวิธีชำระอื่น", 400);
  }

  // ซื้อถังและเปลี่ยนถังใช้ถังเต็มจากคลังเดียวกัน จึงรวมจำนวนต่อ productId ก่อนเทียบสต๊อก
  // ฝากเติมใช้ถังของลูกค้า ไม่กินถังเต็มในคลัง จึงไม่นับ
  const requestedByProduct = new Map<number, number>();
  for (const item of validOrderItems) {
    if (item.saleType === SALETYPE.REFILL) continue;
    requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.quantity);
  }
  const stock = await getOrderableStock(productIds);
  if (!stock) return failure<ORDERRECORD>("Failed to check stock", 500);
  for (const [productId, requested] of requestedByProduct) {
    const available = stock.get(productId) ?? 0;
    if (requested > available) {
      const name = productsById.get(productId)?.name ?? `#${productId}`;
      return failure<ORDERRECORD>(
        available === 0
          ? `สินค้า "${name}" หมดแล้ว`
          : `สินค้า "${name}" มีไม่พอ (สั่ง ${requested} เหลือ ${available})`,
        409,
      );
    }
  }

  const totalAmount = validOrderItems.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );
  const customer = auth.result.results;
  const deliveryAddress = payload.deliveryAddress || customer.address;
  if (!deliveryAddress) return failure<ORDERRECORD>("Delivery address is required", 400);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      userId: customer.id,
      totalAmount,
      paymentMethod: payload.paymentMethod,
      deliveryAddress,
      deliveryLat: payload.deliveryLat ?? null,
      deliveryLng: payload.deliveryLng ?? null,
      note: payload.note || null,
    })
    .select(
      "id, totalAmount, paymentMethod, paymentStatus, status, deliveryAddress, deliveryLat, deliveryLng, note, createdAt",
    )
    .single();

  if (orderError || !order) return failure<ORDERRECORD>("Failed to create order", 500);

  const { data: insertedItems, error: itemsError } = await supabase
    .from("orderItems")
    .insert(validOrderItems.map((item) => ({ ...item, orderId: order.id })))
    .select("id, productId, productNameSnapshot, quantity, unitPrice, totalPrice, saleType");

  if (itemsError || !insertedItems) {
    await supabase.from("orders").delete().eq("id", order.id);
    return failure<ORDERRECORD>("Failed to create order items", 500);
  }

  let payment: ORDERPAYMENTRECORD | null = null;
  if (payload.paymentMethod === PAYMENTMETHOD.QR_SCAN) {
    const { data, error: paymentError } = await supabase
      .from("payments")
      .insert({ orderId: order.id, amount: totalAmount, method: PAYMENTMETHOD.QR_SCAN })
      .select("id, method, status")
      .single();
    if (paymentError || !data) {
      await supabase.from("orderItems").delete().eq("orderId", order.id);
      await supabase.from("orders").delete().eq("id", order.id);
      return failure<ORDERRECORD>("Failed to create payment record", 500);
    }
    payment = data as ORDERPAYMENTRECORD;
  }

  // ต้องรอให้ส่งเสร็จก่อนตอบ เพราะ Vercel อาจหยุด function ทันทีหลังคืน response
  await notifyOrderCreated({
    orderId: order.id,
    userId: customer.id,
    totalAmount,
    paymentMethod: payload.paymentMethod,
    items: validOrderItems,
  });

  return {
    result: apiSuccess("Order created successfully", {
      ...order,
      ...coordinateFields(order),
      totalAmount: Number(order.totalAmount),
      orderItems: insertedItems.map((item) => ({
        ...item,
        productId: Number(item.productId),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice ?? Number(item.unitPrice) * item.quantity),
      })),
      payments: payment ? [payment] : [],
    } as ORDERRECORD),
    status: 201,
  };
}

export async function getCustomerOrders(
  accessToken: string | null,
): Promise<SERVICERESULT<ORDERRECORD[]>> {
  const auth = await authenticateCustomer(accessToken);
  if (auth.result.status === "error") {
    return failure<ORDERRECORD[]>(auth.result.message, auth.status);
  }

  const supabase = createAuthenticatedClient(accessToken!);
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, totalAmount, paymentMethod, paymentStatus, status, deliveryAddress, deliveryLat, deliveryLng, note, createdAt, orderItems(id, productId, productNameSnapshot, quantity, unitPrice, totalPrice, saleType), payments(id, method, status, transferSlips(id, status, createdAt))",
    )
    .eq("userId", auth.result.results.id)
    .order("createdAt", { ascending: false });

  if (error) return failure<ORDERRECORD[]>("Failed to fetch orders", 500);

  const orders = (data ?? []).map((order) => ({
    ...order,
    ...coordinateFields(order),
    totalAmount: Number(order.totalAmount),
    orderItems: (order.orderItems ?? []).map((item) => ({
      ...item,
      productId: Number(item.productId),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice ?? Number(item.unitPrice) * item.quantity),
    })),
  })) as ORDERRECORD[];

  return {
    result: apiSuccess("Orders retrieved successfully", orders),
    status: 200,
  };
}

export async function getCustomerOrderById(
  accessToken: string | null,
  orderId: string,
): Promise<SERVICERESULT<ORDERRECORD>> {
  const auth = await authenticateCustomer(accessToken);
  if (auth.result.status === "error") return failure<ORDERRECORD>(auth.result.message, auth.status);

  const supabase = createAuthenticatedClient(accessToken!);
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, totalAmount, paymentMethod, paymentStatus, status, deliveryAddress, deliveryLat, deliveryLng, note, createdAt, updatedAt, orderItems(id, productId, productNameSnapshot, quantity, unitPrice, totalPrice, saleType), payments(id, method, status, verifiedAt, transferSlips(id, status, rejectReason, createdAt)), debtRecords(debtType, amount, status, debtTransactions(amount))",
    )
    .eq("id", orderId)
    .eq("userId", auth.result.results.id)
    .maybeSingle();
  if (error) return failure<ORDERRECORD>("Failed to load order details", 500);
  if (!data) return failure<ORDERRECORD>("Order not found", 404);

  return {
    result: apiSuccess("Order details retrieved successfully", {
      ...data,
      ...coordinateFields(data),
      totalAmount: Number(data.totalAmount),
      orderItems: (data.orderItems ?? []).map((item) => ({
        ...item,
        productId: Number(item.productId),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice ?? Number(item.unitPrice) * item.quantity),
      })),
      outstandingAmount: (data.debtRecords ?? [])
        .filter((debt) => debt.debtType === "money" && debt.status !== "paid")
        .reduce((total, debt) => total + Math.max(0, Number(debt.amount) - (debt.debtTransactions ?? []).reduce((paid, transaction) => paid + Number(transaction.amount), 0)), 0),
      outstandingCarts: (data.debtRecords ?? [])
        .filter((debt) => debt.debtType === "cart" && debt.status !== "paid")
        .reduce((total, debt) => total + Math.max(0, Number(debt.amount) - (debt.debtTransactions ?? []).reduce((returned, transaction) => returned + Number(transaction.amount), 0)), 0),
      // สำรองไว้บนเว็บ เผื่อลูกค้าบล็อกร้านหรือข้อความใน LINE ส่งไม่ถึง
      promptPayQrUrl:
        data.paymentMethod === PAYMENTMETHOD.QR_SCAN && data.paymentStatus !== "paid" && data.status !== "cancelled"
          ? buildPromptPayQrPath(data.id)
          : null,
    } as ORDERRECORD),
    status: 200,
  };
}
