"use client";

import { useEffect, useState } from "react";
import type { Product, ProductFilterState } from "@/app/productPage/_domain/entities";
import { EMPTY_PRODUCT_FILTER } from "@/app/productPage/_domain/entities";
import { getFilterOptions, type FilterOptions } from "@/app/productPage/_application/getFilterOptions";
import { getProductCatalog } from "@/app/productPage/_application/getProductCatalog";
import { SupabaseProductRepository } from "@/app/productPage/_infrastructure/supabaseProductRepository";

const productRepository = new SupabaseProductRepository();

const EMPTY_FILTER_OPTIONS: FilterOptions = { brands: [], weightsKg: [] };

export function useProductCatalog() {
  const [filter, setFilter] = useState<ProductFilterState>(EMPTY_PRODUCT_FILTER);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(EMPTY_FILTER_OPTIONS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFilterOptions() {
      try {
        const options = await getFilterOptions(productRepository);
        if (isMounted) setFilterOptions(options);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดตัวเลือกสินค้าได้");
        }
      }
    }

    void loadFilterOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setIsLoading(true);
      try {
        const result = await getProductCatalog(productRepository, filter);
        if (isMounted) {
          setProducts(result);
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
  }, [filter]);

  function updateFilter(patch: Partial<ProductFilterState>) {
    setFilter((prev) => ({ ...prev, ...patch }));
  }

  return { filter, updateFilter, products, isLoading, filterOptions, errorMessage };
}