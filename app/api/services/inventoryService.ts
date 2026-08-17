import type { SupabaseClient } from "@supabase/supabase-js";
import { apiError, apiSuccess } from "../response";
import type { CREATEINVENTORYPAYLOAD, INVENTORY } from "@/app/models/inventory";
import type { SERVICERESULT } from "@/app/models/api";
import { createPublicClient } from "../util/supabase/public";

const STOCK_STATUSES = new Set(["full", "empty", "damaged"]);
const ITEM_CONDITIONS = new Set(["new", "old", "normal"]);

function failure<T>(message: string, status: number): SERVICERESULT<T> {
  return { result: apiError(message), status };
}

function databaseFailure<T>(message: string, error: { message?: string }): SERVICERESULT<T> {
  const detail = process.env.NODE_ENV === "development" && error.message ? `: ${error.message}` : "";
  return failure(`${message}${detail}`, 500);
}

export async function getAllInventoryItems() {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("inventoryProducts").select("*, products(id, name, size)");

  if (error) return apiError("Failed to fetch inventory items");
  return apiSuccess("Inventory items retrieved successfully", data);
}

export async function getInventoryItemById(id: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("inventoryProducts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return apiError("Failed to fetch inventory item");
  if (!data) return apiError("Inventory item not found");

  return apiSuccess("Inventory item retrieved successfully", data);
}

export async function addInventoryItem(
  item: CREATEINVENTORYPAYLOAD,
  supabase: SupabaseClient,
) : Promise<SERVICERESULT<{ inventory: INVENTORY; inventoryLog: unknown }>> {
  const productId = typeof item.productId === "number" ? item.productId : Number(item.productId);
  const quantityOnHand = typeof item.quantityOnHand === "number"
    ? item.quantityOnHand
    : Number(item.quantityOnHand ?? 0);
  const minimumStock = typeof item.minimumStock === "number"
    ? item.minimumStock
    : Number(item.minimumStock ?? 0);

  if (!Number.isInteger(productId) || productId <= 0) {
    return failure("Valid product id is required", 400);
  }
  const stockStatus = typeof item.stockStatus === "string" && item.stockStatus.trim() ? item.stockStatus : null;
  if (stockStatus !== null && !STOCK_STATUSES.has(stockStatus)) {
    return failure("Invalid stock status", 400);
  }
  if (typeof item.itemCondition !== "string" || !ITEM_CONDITIONS.has(item.itemCondition)) return failure("Invalid item condition", 400);
  if (!Number.isInteger(quantityOnHand) || quantityOnHand <= 0) {
    return failure("Quantity on hand must be a positive integer", 400);
  }
  if (!Number.isInteger(minimumStock) || minimumStock < 0) {
    return failure("Minimum stock must be a non-negative integer", 400);
  }

  const { data, error } = await supabase
    .rpc("create_inventory_as_admin", {
      p_product_id: productId,
      p_stock_status: stockStatus,
      p_item_condition: item.itemCondition,
      p_quantity_on_hand: quantityOnHand,
      p_minimum_stock: minimumStock,
      p_note: typeof item.note === "string" ? item.note.trim() || null : null,
    })
    .single();

  if (error) return databaseFailure("Failed to add inventory item", error);
  if (!data) return failure("Failed to add inventory item", 500);

  return {
    result: apiSuccess("Inventory item created successfully", data as { inventory: INVENTORY; inventoryLog: unknown }),
    status: 201,
  };
}

/**
 * Marks an order as delivered and deducts every ordered item from full-cylinder
 * inventory in the same database transaction. The database function locks the
 * inventory rows, preventing concurrent deliveries from overselling stock.
 */
export async function fulfillOrderInventory(
  orderId: string,
  supabase: SupabaseClient,
): Promise<SERVICERESULT<unknown>> {
  const { data, error } = await supabase
    .rpc("fulfill_order_as_admin", {
      p_order_id: orderId,
    })
    .single();

  if (error || !data) {
    return failure("Unable to deliver order because inventory could not be updated", 400);
  }

  return {
    result: apiSuccess("Order delivered and inventory updated", data),
    status: 200,
  };
}

export async function deleteInventoryItem(
  id: string,
  supabase: SupabaseClient,
): Promise<SERVICERESULT<unknown>> {
  const { data, error } = await supabase.rpc("delete_inventory_as_admin", { p_inventory_id: id }).single();
  if (error || !data) return failure("Unable to delete inventory that is already used by an order", 400);
  return { result: apiSuccess("Inventory item deleted successfully", data), status: 200 };
}

export async function updateInventoryItem(
  id: string,
  item: CREATEINVENTORYPAYLOAD,
  supabase: SupabaseClient,
): Promise<SERVICERESULT<unknown>> {
  const quantityOnHand = typeof item.quantityOnHand === "number" ? item.quantityOnHand : Number(item.quantityOnHand);
  const minimumStock = typeof item.minimumStock === "number" ? item.minimumStock : Number(item.minimumStock);
  const stockStatus = typeof item.stockStatus === "string" && item.stockStatus.trim() ? item.stockStatus : null;
  if (stockStatus !== null && !STOCK_STATUSES.has(stockStatus)) return failure("Invalid stock status", 400);
  if (typeof item.itemCondition !== "string" || !ITEM_CONDITIONS.has(item.itemCondition)) return failure("Invalid item condition", 400);
  if (!Number.isInteger(quantityOnHand) || quantityOnHand < 0) return failure("Quantity on hand must be a non-negative integer", 400);
  if (!Number.isInteger(minimumStock) || minimumStock < 0) return failure("Minimum stock must be a non-negative integer", 400);

  const { data, error } = await supabase.rpc("update_inventory_as_admin", {
    p_inventory_id: id,
    p_stock_status: stockStatus,
    p_item_condition: item.itemCondition,
    p_quantity_on_hand: quantityOnHand,
    p_minimum_stock: minimumStock,
    p_note: typeof item.note === "string" ? item.note.trim() || null : null,
  }).single();
  if (error) return databaseFailure("Failed to update inventory item", error);
  if (!data) return failure("Failed to update inventory item", 500);
  return { result: apiSuccess("Inventory item updated successfully", data), status: 200 };
}

