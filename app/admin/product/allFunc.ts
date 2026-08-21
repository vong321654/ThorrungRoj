"use client";

import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import type { PRODUCT, PRODUCTINPUT } from "@/app/models/product";
import type { PRODUCTBAND, PRODUCTTYPE, PRODUCTUNIT } from "@/app/models/productsType";

const supabase = createClient();

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  const result = (await response.json()) as APIRESULT<T>;
  if (!response.ok || result.status === "error") throw new Error(result.message);
  return result.results;
}

export function getProductList() {
  return apiRequest<PRODUCT[]>("/api/product");
}

export function searchProducts(name: string) {
  return apiRequest<PRODUCT[]>(`/api/product?name=${encodeURIComponent(name)}`);
}

export async function getProductById(id: number) {
  const results = await apiRequest<PRODUCT[]>(`/api/product?id=${id}`);
  return results[0] ?? null;
}

export function addProduct(input: PRODUCTINPUT) {
  return apiRequest<PRODUCT>("/api/product", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProduct(id: number, input: Partial<PRODUCTINPUT>) {
  return apiRequest<PRODUCT>(`/api/product?id=${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProduct(id: number) {
  return apiRequest<null>(`/api/product?id=${id}`, {
    method: "DELETE",
  });
}

export function getBrandList() {
  return apiRequest<PRODUCTBAND[]>("/api/product/brand");
}

export function addBrand(name: string) {
  return apiRequest<PRODUCTBAND>("/api/product/brand", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateBrand(id: number, name: string) {
  return apiRequest<PRODUCTBAND>("/api/product/brand", {
    method: "PATCH",
    body: JSON.stringify({ id, name }),
  });
}

export function deleteBrand(id: number) {
  return apiRequest<null>(`/api/product/brand?id=${id}`, { method: "DELETE" });
}

export function getTypeList() {
  return apiRequest<PRODUCTTYPE[]>("/api/product/type");
}

export function addType(name: string) {
  return apiRequest<PRODUCTTYPE>("/api/product/type", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateType(id: number, name: string) {
  return apiRequest<PRODUCTTYPE>(`/api/product/type?id=${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteType(id: number) {
  return apiRequest<null>(`/api/product/type?id=${id}`, { method: "DELETE" });
}

export function getUnitList() {
  return apiRequest<PRODUCTUNIT[]>("/api/product/unit");
}

export function addUnit(name: string) {
  return apiRequest<PRODUCTUNIT>("/api/product/unit", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateUnit(id: number, name: string) {
  return apiRequest<PRODUCTUNIT>(`/api/product/unit?id=${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteUnit(id: number) {
  return apiRequest<null>(`/api/product/unit?id=${id}`, { method: "DELETE" });
}
