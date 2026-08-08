"use client";

import type { PRODUCT } from "@/app/models/product";
import type { ApiResult } from "@/app/api/response";
import { useEffect, useState } from "react";

export default function ProductPage() {
    const [products, setProducts] = useState<PRODUCT[]>([]);

    useEffect(() => {
        async function loadProducts() {
            const response = await fetch("/api/product");
            const result = (await response.json()) as ApiResult<PRODUCT[]>;

            if (result.status === "success") {
                setProducts(result.results ?? []);
            }
        }

        void loadProducts();
    }, []);

    return (
        <div>
            {products.map((product) => (
                <p key={product.id}>{product.name}</p>
            ))}
        </div>
    );
}
