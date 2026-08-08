import { createClient } from "../util/supabase/client";
import { apiError, apiSuccess } from "../response";

const supabase = createClient();

//get all for Admin
export async function getAllProductType() {
  const { data, error } = await supabase.from("productsType").select("*");
  if (error) {
    return apiError("Failed to fetch product type");
  }
  return apiSuccess("Product type retrieved successfully", data);
}
//getType for user
export async function getType() {
  const { data, error } = await supabase.from("productsType").select("id name");
  if (error) {
    return apiError("Failed to fetch product type");
  }
  return apiSuccess("Product type retrieved successfully", data);
}
// crate type
export async function addProductType(name: string) {
  const { data, error } = await supabase
    .from("productsType")
    .insert({ name })
    .select()
    .single();
  if (error) {
    return apiError("Failed to add product type");
  }
  return apiSuccess("Product type added successfully", data);
}
//updatetype
export async function updateProductType(id: number, name: string) {
  const { data, error } = await supabase
    .from("productsType")
    .update({ name })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return apiError("Failed to update product type");
  }
  return apiSuccess("Product type updated successfully", data);
}
//delete type
export async function deleteProductType(id: number) {
  const { data, error } = await supabase
    .from("productsType")
    .delete()
    .eq("id", id);
  if (error) {
    return apiError("Failed to delete product type");
  }
  return apiSuccess("Product type deleted successfully", data);
}
export async function getTypeById(id: number) {
  const { data, error } = await supabase
    .from("productsType")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    return apiError("Failed to get product type");
  }
  return apiSuccess("Product type retrieved successfully", data);
}
