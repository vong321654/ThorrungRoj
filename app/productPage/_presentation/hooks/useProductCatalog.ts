"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, ProductFilterState } from "@/app/productPage/_domain/entities";
import { EMPTY_PRODUCT_FILTER } from "@/app/productPage/_domain/entities";
import { getFilterOptions, type FilterOptions } from "@/app/productPage/_application/getFilterOptions";
import { getProductCatalog } from "@/app/productPage/_application/getProductCatalog";
import { SupabaseProductRepository } from "@/app/productPage/_infrastructure/supabaseProductRepository";

const productRepository = new SupabaseProductRepository();
let pendingCatalogRequest: Promise<Product[]> | null = null;

const EMPTY_FILTER_OPTIONS: FilterOptions = { brands: [], weightsKg: [] };

function loadProductCatalog() {
  if (pendingCatalogRequest) return pendingCatalogRequest;

  const request = productRepository.listAllProducts();
  pendingCatalogRequest = request;
  void request.then(
    () => {
      if (pendingCatalogRequest === request) pendingCatalogRequest = null;
    },
    () => {
      if (pendingCatalogRequest === request) pendingCatalogRequest = null;
    },
  );
  return request;
}

export function useProductCatalog() {
  const [filter, setFilter] = useState<ProductFilterState>(EMPTY_PRODUCT_FILTER);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const result = await loadProductCatalog();
        if (isMounted) {
          setAllProducts(result);
          setErrorMessage(null);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดรายการถังแก๊สได้");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  const filterOptions = useMemo(
    () => allProducts.length > 0 ? getFilterOptions(allProducts) : EMPTY_FILTER_OPTIONS,
    [allProducts],
  );
  const products = useMemo(
    () => getProductCatalog(allProducts, filter),
    [allProducts, filter],
  );

  function updateFilter(patch: Partial<ProductFilterState>) {
    setFilter((prev) => ({ ...prev, ...patch }));
  }

  return { filter, updateFilter, products, isLoading, filterOptions, errorMessage };
}
