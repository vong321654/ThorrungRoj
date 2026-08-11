import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/app/api/util/supabase/public";
import { apiError, apiSuccess } from "../response";

export type ProductPayload = Record<string, unknown>;

const productWriteFields = [
  "name",
  "brandId",
  "size",
  "typeId",
  "unitId",
  "sellPrice",
  "exchangePrice",
  "refillPrice",
  "isActive",
] as const;

function pickProductValues(data: ProductPayload) {
  const values: ProductPayload = {};
  for (const field of productWriteFields) {
    if (field in data) values[field] = data[field];
  }
  return values;
}

function databaseError(message: string, error: { message?: string }) {
  const detail = process.env.NODE_ENV === "development" && error.message
    ? `: ${error.message}`
    : "";
  return apiError(`${message}${detail}`);
}

const productFields =
  "id, name, brandId, size, typeId, unitId, sellPrice, exchangePrice, refillPrice, imageUrl, isActive";

//Get All Products
export async function getAllProduct() {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("products").select(productFields);
  if (error) return databaseError("Failed to fetch products", error);
  return apiSuccess("Products retrieved successfully", data);
}

//Get Product Item
export async function getProductItem(id: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("products").select(productFields).eq("id", id);
  if (error) return databaseError("Failed to fetch product", error);
  return apiSuccess("Product retrieved successfully", data);
}

//Update Product
export async function updateProduct(
  id: string,
  data: ProductPayload,
  supabase: SupabaseClient,
  updatedBy: string,
) {
  const values = pickProductValues(data);
  if (Object.keys(values).length === 0) return apiError("No editable product fields supplied");

  const { data: updatedProduct, error } = await supabase
    .from("products")
    .update({
      ...values,
      updatedBy,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return databaseError("Failed to update product", error);
  return apiSuccess("Product updated successfully", updatedProduct);
}

//Delete Product
export async function deleteProduct(id: string, supabase: SupabaseClient) {
  const { data, error } = await supabase.from("products").delete().eq("id", id);
  if (error) return databaseError("Failed to delete product", error);
  return apiSuccess("Product deleted successfully", data);
}

//Add Product
export async function addProduct(
  data: ProductPayload,
  supabase: SupabaseClient,
  createdBy: string,
) {
  const values = pickProductValues(data);
  const { data: newProduct, error } = await supabase
    .from("products")
    .insert({ ...values, createdBy })
    .select()
    .single();

  if (error) return databaseError("Failed to add product", error);
  return apiSuccess("Product created successfully", newProduct);
}

//fillter
export async function getFilteredProduct(data: ProductPayload) {
  const supabase = createPublicClient();
  const name = data.name;
  const size = data.size;
  const brand = data.brand ?? data.brandId;

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return apiError("Product name filter must be a non-empty string");
  }

  const parsedSize =
    typeof size === "number"
      ? size
      : typeof size === "string"
        ? Number(size)
        : undefined;
  if (
    size !== undefined &&
    (!Number.isFinite(parsedSize) || parsedSize! <= 0)
  ) {
    return apiError("Product size filter must be a positive number");
  }

  const parsedBrand =
    typeof brand === "number"
      ? brand
      : typeof brand === "string"
        ? Number(brand)
        : undefined;
  if (
    brand !== undefined &&
    (!Number.isInteger(parsedBrand) || parsedBrand! <= 0)
  ) {
    return apiError("Product brand filter must be a positive number");
  }

  let query = supabase.from("products").select(productFields);
  if (typeof name === "string") query = query.ilike("name", `%${name.trim()}%`);
  if (parsedSize !== undefined) query = query.eq("size", parsedSize);
  if (parsedBrand !== undefined) query = query.eq("brandId", parsedBrand);

  const { data: products, error } = await query;
  if (error) return databaseError("Failed to filter products", error);
  return apiSuccess("Products retrieved successfully", products);
}
