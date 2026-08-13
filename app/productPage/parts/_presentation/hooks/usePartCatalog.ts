"use client";

import { useEffect, useState } from "react";
import type { Part } from "@/app/productPage/parts/_domain/entities";
import { getPartCatalog } from "@/app/productPage/parts/_application/getPartCatalog";
import { SupabasePartRepository } from "@/app/productPage/parts/_infrastructure/supabasePartRepository";

const partRepository = new SupabasePartRepository();

export function usePartCatalog() {
  const [parts, setParts] = useState<Part[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadParts() {
      setIsLoading(true);
      const result = await getPartCatalog(partRepository);
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
