import { createPublicClient } from "../util/supabase/public";
import { apiError, apiSuccess } from "../response";
import type { SupabaseClient } from "@supabase/supabase-js";

function databaseError(message: string, error: { message?: string }) {
  const detail = process.env.NODE_ENV === "development" && error.message
    ? `: ${error.message}`
    : "";
  return apiError(`${message}${detail}`);
}

export async function getAllBrand() {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("productsBrand").select("*");
  if (error) {
    return apiError("Failed to fetch brands");
  }
  return apiSuccess("Brands retrieved successfully", data);
}

export async function getBrandById(id: number) {
  const supabase = createPublicClient();
  if (!id) {
    return apiError("Invalid brand id");
  } else {
    const { data, error } = await supabase
      .from("productsBrand")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return apiError("Failed to fetch brand");
    }
    return apiSuccess("Brand retrieved successfully", data);
  }
}

export async function addBrand(
  name: string,
  supabase: SupabaseClient,
  createdBy: string,
) {
  if (!name.trim()) return apiError("Brand name is required");
  if (!createdBy) return apiError("Creator is required");

  const { data, error } = await supabase
    .from("productsBrand")
    .insert({ name: name.trim(), createdBy })
    .select()
    .single();
  if (error) {
    return databaseError("Failed to add brand", error);
  }
  return apiSuccess("Brand added successfully", data);
}

export async function updateBrand(
  id: number,
  name: string,
  supabase: SupabaseClient,
  updatedBy: string,
) {
  if (!id || !name.trim()) return apiError("Invalid brand id or name");

  const { data, error } = await supabase
    .from("productsBrand")
    .update({
      name: name.trim(),
      updatedBy,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return databaseError("Failed to update brand", error);
  }
  return apiSuccess("Brand updated successfully", data);
}

export async function deleteBrand(id: number, supabase: SupabaseClient) {
  if (!id) {
    return apiError("Invalid brand id");
  }

  const { data, error } = await supabase
    .from("productsBrand")
    .delete()
    .eq("id", id);
  if (error) return databaseError("Failed to delete brand", error);
  return apiSuccess("Brand deleted successfully", data);
}
