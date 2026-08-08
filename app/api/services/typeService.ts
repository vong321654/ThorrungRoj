import { cookies } from "next/headers";
import { createClient } from "../util/supabase/server";
import { apiError, apiSuccess } from "../response";
import type { SupabaseClient } from "@supabase/supabase-js";

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient(await cookies());
}

function databaseError(message: string, error: { message?: string }) {
  const detail = process.env.NODE_ENV === "development" && error.message
    ? `: ${error.message}`
    : "";
  return apiError(`${message}${detail}`);
}

export async function getAllProductType(client?: SupabaseClient) {
  const supabase = await getSupabase(client);
  const { data, error } = await supabase.from("productsType").select("*").order("name");
  if (error) return databaseError("Failed to fetch product types", error);
  return apiSuccess("Product types retrieved successfully", data ?? []);
}

export async function getType() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("productsType").select("id, name").order("name");
  if (error) return databaseError("Failed to fetch product types", error);
  return apiSuccess("Product types retrieved successfully", data ?? []);
}

export async function addProductType(name: string, client?: SupabaseClient, createdBy?: string) {
  if (!name.trim()) return apiError("Product type name is required");
  if (!createdBy) return apiError("Creator is required");
  const supabase = await getSupabase(client);
  const { data, error } = await supabase
    .from("productsType")
    .insert({ name: name.trim(), createdBy })
    .select()
    .single();
  if (error) return databaseError("Failed to add product type", error);
  return apiSuccess("Product type added successfully", data);
}

export async function updateProductType(id: number, name: string, client?: SupabaseClient) {
  if (!name.trim()) return apiError("Product type name is required");
  const supabase = await getSupabase(client);
  const { data, error } = await supabase
    .from("productsType")
    .update({ name: name.trim(), updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return databaseError("Failed to update product type", error);
  return apiSuccess("Product type updated successfully", data);
}

export async function deleteProductType(id: number, client?: SupabaseClient) {
  const supabase = await getSupabase(client);
  const { data, error } = await supabase.from("productsType").delete().eq("id", id);
  if (error) return databaseError("Failed to delete product type", error);
  return apiSuccess("Product type deleted successfully", data);
}

export async function getTypeById(id: number) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("productsType").select("*").eq("id", id).maybeSingle();
  if (error) return databaseError("Failed to get product type", error);
  if (!data) return apiError("Product type not found");
  return apiSuccess("Product type retrieved successfully", data);
}
