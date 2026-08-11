"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import type { Product } from "@/app/productPage/_domain/entities";
import type { SaleType } from "@/app/productPage/_shared/domain/cartItem";
import ProductCard from "./ProductCard";

type ProductGridProps = {
  products: Product[];
  isLoading: boolean;
  onSelect: (product: Product, saleType: SaleType) => void;
};

const SKELETON_COUNT = 10;

export default function ProductGrid({ products, isLoading, onSelect }: ProductGridProps) {
  if (isLoading) {
    return (
      <Grid container spacing={2} sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <Grid key={index} size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}>
            <Skeleton variant="rounded" height={230} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (products.length === 0) {
    return (
      <Box sx={{ px: { xs: 2, md: 3 }, py: 6, textAlign: "center" }}>
        <Typography color="text.secondary">ไม่พบถังแก๊สที่ตรงกับตัวเลือกที่เลือกไว้</Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2} sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
      {products.map((product) => (
        <Grid key={product.id} size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}>
          <ProductCard product={product} onSelect={onSelect} />
        </Grid>
      ))}
    </Grid>
  );
}
