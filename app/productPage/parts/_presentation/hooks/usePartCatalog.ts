"use client";

import { useEffect, useState } from "react";
import type { Part } from "@/app/productPage/parts/_domain/entities";
import { getPartCatalog } from "@/app/productPage/parts/_application/getPartCatalog";
import { SupabasePartRepository } from "@/app/productPage/parts/_infrastructure/supabasePartRepository";

const partRepository = new SupabasePartRepository();
let pendingPartCatalogRequest: Promise<Part[]> | null = null;

function loadPartCatalog() {
  if (pendingPartCatalogRequest) return pendingPartCatalogRequest;

  const request = getPartCatalog(partRepository);
  pendingPartCatalogRequest = request;
  void request.then(
    () => {
      if (pendingPartCatalogRequest === request) pendingPartCatalogRequest = null;
    },
    () => {
      if (pendingPartCatalogRequest === request) pendingPartCatalogRequest = null;
    },
  );
  return request;
}

export function usePartCatalog() {
  const [parts, setParts] = useState<Part[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadParts() {
      setIsLoading(true);
      const result = await loadPartCatalog();
      if (isMounted) {
        setParts(result);
        setIsLoading(false);
      }
    }

    void loadParts();
    return () => {
      isMounted = false;
    };
  }, []);

  return { parts, isLoading };
}
