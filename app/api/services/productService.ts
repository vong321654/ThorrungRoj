import { createPublicClient } from "@/app/api/util/supabase/public";
import { createClient } from "@/app/api/util/supabase/server";
import { cookies } from "next/headers";
import { apiError, apiSuccess } from "../response";

export type ProductPayload = Record<string, unknown>;

//Get All Products
export async function getAllProduct() {
  const supabase = createPublicClient();
  try {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id name brandId size typeId unitId sellPrice exchangePrice refillPrice isActive",
      );
    if (error) {
      throw error;
    }
    return apiSuccess("Products retrieved successfully", data);
  } catch {
    return apiError("Failed to fetch products");
  }
}

//Get Product Item
export async function getProductItem(id: string) {
  const supabase = createPublicClient();
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id);
    if (error) {
      throw error;
    }
    return apiSuccess("Product retrieved successfully", data);
  } catch {
    return apiError("Failed to fetch product");
  }
}

//Update Product
export async function updateProduct(id: string, data: ProductPayload) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  try {
    const { data: updatedProduct, error } = await supabase
      .from("products")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return apiSuccess("Product updated successfully", updatedProduct);
  } catch {
    return apiError("Failed to update product");
  }
}

//Delete Product
export async function deleteProduct(id: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  try {
    const { data, error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);
    if (error) {
      throw error;
    }
    return apiSuccess("Product deleted successfully", data);
  } catch {
    return apiError("Failed to delete product");
  }
}

//Add Product
export async function addProduct(data: ProductPayload) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  try {
    const { data: newProduct, error } = await supabase
      .from("products")
      .insert(data)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return apiSuccess("Product created successfully", newProduct);
  } catch {
    return apiError("Failed to add product");
  }
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

  let query = supabase.from("products").select("*");
  if (typeof name === "string") query = query.ilike("name", `%${name.trim()}%`);
  if (parsedSize !== undefined) query = query.eq("size", parsedSize);
  if (parsedBrand !== undefined) query = query.eq("brandId", parsedBrand);

  const { data: products, error } = await query;
  if (error) return apiError("Failed to filter products");
  return apiSuccess("Products retrieved successfully", products);
}
