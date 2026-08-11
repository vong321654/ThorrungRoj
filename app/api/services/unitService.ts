import type { SupabaseClient } from "@supabase/supabase-js";
import { apiError, apiSuccess } from "../response";
import { createPublicClient } from "../util/supabase/public";

function databaseError(message: string, error: { message?: string }) {
  const detail = process.env.NODE_ENV === "development" && error.message
    ? `: ${error.message}`
    : "";
  return apiError(`${message}${detail}`);
}

export async function getAllProductUnit() {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("productsUnit").select("*").order("unit");
  if (error) return databaseError("Failed to fetch product units", error);
  return apiSuccess("Product units retrieved successfully", data ?? []);
}

export async function getUnitById(id: number) {
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid product unit id");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("productsUnit")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return databaseError("Failed to fetch product unit", error);
  if (!data) return apiError("Product unit not found");
  return apiSuccess("Product unit retrieved successfully", data);
}

export async function addProductUnit(
  name: string,
  supabase: SupabaseClient,
  createdBy: string,
) {
  if (!name.trim()) return apiError("Product unit name is required");
  if (!createdBy) return apiError("Creator is required");

  const { data, error } = await supabase
    .from("productsUnit")
    .insert({ unit: name.trim(), createdBy })
    .select()
    .single();
  if (error) return databaseError("Failed to add product unit", error);
  return apiSuccess("Product unit added successfully", data);
}

export async function updateProductUnit(
  id: number,
  name: string,
  supabase: SupabaseClient,
) {
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid product unit id");
  if (!name.trim()) return apiError("Product unit name is required");

  const { data, error } = await supabase
    .from("productsUnit")
    .update({ unit: name.trim(), updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return databaseError("Failed to update product unit", error);
  return apiSuccess("Product unit updated successfully", data);
}

export async function deleteProductUnit(id: number, supabase: SupabaseClient) {
  if (!Number.isInteger(id) || id <= 0) return apiError("Invalid product unit id");

  const { data, error } = await supabase.from("productsUnit").delete().eq("id", id);
  if (error) return databaseError("Failed to delete product unit", error);
  return apiSuccess("Product unit deleted successfully", data);
}
