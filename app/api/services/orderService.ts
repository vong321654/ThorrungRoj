import type { User as AuthUser } from "@supabase/supabase-js";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import { apiError, apiSuccess, type ApiResult } from "@/app/api/response";
import type {
  CheckoutItemInput,
  CheckoutPayload,
  OrderRecord,
  PaymentMethod,
} from "@/app/models/order";
import type { SaleType } from "@/app/productPage/_shared/domain/cartItem";

type ServiceResult<T> = {
  result: ApiResult<T>;
  status: number;
};

type Customer = {
  id: string;
  address: string | null;
  isActive: boolean;
};

type ProductRow = {
  id: number;
  name: string;
  sellPrice: number | string;
  exchangePrice: number | string | null;
  refillPrice: number | string | null;
  isActive: boolean;
};

const SALE_TYPES = new Set<SaleType>(["sell", "exchange", "refill"]);
const PAYMENT_METHODS = new Set<PaymentMethod>([
  "cash",
  "qrScan",
]);

function failure<T>(message: string, status: number): ServiceResult<T> {
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
  if (!accessToken) return failure<Customer>("Missing access token", 401);

  const supabase = createAdminClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return failure<Customer>("Invalid session", 401);
  if (!isLineUser(authData.user)) {
    return failure<Customer>("Please sign in with LINE to place an order", 403);
  }

  const { data: customer, error } = await supabase
    .from("users")
    .select("id, address, isActive")
    .eq("authId", authData.user.id)
    .maybeSingle();

  if (error) return failure<Customer>("Failed to load customer data", 500);
  if (!customer) return failure<Customer>("Customer profile was not found", 403);
  if (!customer.isActive) return failure<Customer>("Customer account is inactive", 403);

  return {
    result: apiSuccess("Customer authenticated", customer as Customer),
    status: 200,
  };
}

function parseCheckoutPayload(value: unknown): CheckoutPayload | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<CheckoutPayload>;
  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 50) {
    return null;
  }
  if (typeof payload.paymentMethod !== "string" || !PAYMENT_METHODS.has(payload.paymentMethod)) {
    return null;
  }

  const items: CheckoutItemInput[] = [];
  for (const item of payload.items) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Partial<CheckoutItemInput>;
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
    items.push(candidate as CheckoutItemInput);
  }

  return {
    items,
    paymentMethod: payload.paymentMethod as PaymentMethod,
    ...(typeof payload.deliveryAddress === "string"
      ? { deliveryAddress: payload.deliveryAddress.trim() }
      : {}),
    ...(typeof payload.note === "string" ? { note: payload.note.trim() } : {}),
  };
}

function getUnitPrice(product: ProductRow, saleType: SaleType) {
  if (saleType === "exchange") return Number(product.exchangePrice);
  if (saleType === "refill") return Number(product.refillPrice);
  return Number(product.sellPrice);
}

export async function createOrder(
  accessToken: string | null,
  rawPayload: unknown,
): Promise<ServiceResult<OrderRecord>> {
  const auth = await authenticateCustomer(accessToken);
  if (auth.result.status === "error") {
    return failure<OrderRecord>(auth.result.message, auth.status);
  }

  const payload = parseCheckoutPayload(rawPayload);
  if (!payload) return failure<OrderRecord>("Invalid checkout payload", 400);

  const combinedItems = new Map<string, CheckoutItemInput>();
  for (const item of payload.items) {
    const key = `${item.productId}:${item.saleType}`;
    const current = combinedItems.get(key);
    const quantity = (current?.quantity ?? 0) + item.quantity;
    if (quantity > 100) return failure<OrderRecord>("Product quantity is too large", 400);
    combinedItems.set(key, { ...item, quantity });
  }

  const items = [...combinedItems.values()];
  const productIds = [...new Set(items.map((item) => item.productId))];
  const supabase = createAdminClient();
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, sellPrice, exchangePrice, refillPrice, isActive")
    .in("id", productIds);

  if (productsError) return failure<OrderRecord>("Failed to validate products", 500);
  if (!products || products.length !== productIds.length) {
    return failure<OrderRecord>("One or more products were not found", 400);
  }

  const productsById = new Map(
    (products as ProductRow[]).map((product) => [Number(product.id), product]),
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
    return failure<OrderRecord>("A product is inactive or has no price for the selected sale type", 400);
  }

  const validOrderItems = orderItems.filter((item) => item !== null);
  const totalAmount = validOrderItems.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );
  const customer = auth.result.results;
  const deliveryAddress = payload.deliveryAddress || customer.address;
  if (!deliveryAddress) return failure<OrderRecord>("Delivery address is required", 400);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      userId: customer.id,
      totalAmount,
      paymentMethod: payload.paymentMethod,
      deliveryAddress,
      note: payload.note || null,
    })
    .select(
      "id, totalAmount, paymentMethod, paymentStatus, status, deliveryAddress, note, createdAt",
    )
    .single();

  if (orderError || !order) return failure<OrderRecord>("Failed to create order", 500);

  const { data: insertedItems, error: itemsError } = await supabase
    .from("orderItems")
    .insert(validOrderItems.map((item) => ({ ...item, orderId: order.id })))
    .select("id, productId, productNameSnapshot, quantity, unitPrice, totalPrice, saleType");

  if (itemsError || !insertedItems) {
    await supabase.from("orders").delete().eq("id", order.id);
    return failure<OrderRecord>("Failed to create order items", 500);
  }

  return {
    result: apiSuccess("Order created successfully", {
      ...order,
      totalAmount: Number(order.totalAmount),
      orderItems: insertedItems.map((item) => ({
        ...item,
        productId: Number(item.productId),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice ?? Number(item.unitPrice) * item.quantity),
      })),
    } as OrderRecord),
    status: 201,
  };
}

export async function getCustomerOrders(
  accessToken: string | null,
): Promise<ServiceResult<OrderRecord[]>> {
  const auth = await authenticateCustomer(accessToken);
  if (auth.result.status === "error") {
    return failure<OrderRecord[]>(auth.result.message, auth.status);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, totalAmount, paymentMethod, paymentStatus, status, deliveryAddress, note, createdAt, orderItems(id, productId, productNameSnapshot, quantity, unitPrice, totalPrice, saleType)",
    )
    .eq("userId", auth.result.results.id)
    .order("createdAt", { ascending: false });

  if (error) return failure<OrderRecord[]>("Failed to fetch orders", 500);

  const orders = (data ?? []).map((order) => ({
    ...order,
    totalAmount: Number(order.totalAmount),
    orderItems: (order.orderItems ?? []).map((item) => ({
      ...item,
      productId: Number(item.productId),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice ?? Number(item.unitPrice) * item.quantity),
    })),
  })) as OrderRecord[];

  return {
    result: apiSuccess("Orders retrieved successfully", orders),
    status: 200,
  };
}
