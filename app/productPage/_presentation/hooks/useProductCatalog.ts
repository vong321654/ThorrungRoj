"use client";

import { useEffect, useState } from "react";
import type { Product, ProductFilterState } from "@/app/productPage/_domain/entities";
import { EMPTY_PRODUCT_FILTER } from "@/app/productPage/_domain/entities";
import { getFilterOptions, type FilterOptions } from "@/app/productPage/_application/getFilterOptions";
import { getProductCatalog } from "@/app/productPage/_application/getProductCatalog";
import { MockProductRepository } from "@/app/productPage/_infrastructure/mockProductRepository";

const productRepository = new MockProductRepository();

const EMPTY_FILTER_OPTIONS: FilterOptions = { brands: [], weightsKg: [] };

export function useProductCatalog() {
  const [filter, setFilter] = useState<ProductFilterState>(EMPTY_PRODUCT_FILTER);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(EMPTY_FILTER_OPTIONS);

  useEffect(() => {
    let isMounted = true;

    async function loadFilterOptions() {
      const options = await getFilterOptions(productRepository);
      if (isMounted) setFilterOptions(options);
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
      const result = await getProductCatalog(productRepository, filter);
      if (isMounted) {
        setProducts(result);
        setIsLoading(false);
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

  return { filter, updateFilter, products, isLoading, filterOptions };
}