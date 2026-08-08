import { createClient } from "@/app/api/util/supabase/server";
import { cookies } from "next/headers";
import { apiError, apiSuccess } from "../response";

export type ProductPayload = Record<string, unknown>;

//Get All Products
export async function getAllProduct() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  try {
    const { data, error } = await supabase.from("products").select("*");
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
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
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
