"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import type { Product } from "@/app/productPage/_domain/entities";
import { BRAND_ACCENT_COLOR } from "../brandTheme";
import GasCylinderGlyph from "./GasCylinderGlyph";

type ProductCardProps = {
  product: Product;
  onSelect: (product: Product) => void;
};

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  const accentColor = BRAND_ACCENT_COLOR[product.brand];

  return (
    <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ height: 140, p: 2, display: "flex", justifyContent: "center", bgcolor: "#f9fafb" }}>
        <Box sx={{ width: 90 }}>
          <GasCylinderGlyph accentColor={accentColor} label={product.brandLabel.charAt(0)} />
        </Box>
      </Box>
      <CardContent sx={{ flexGrow: 1, textAlign: "center", pb: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {product.brandLabel} {product.weightKg}กก.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ราคา : {product.price.toLocaleString("th-TH")} บาท
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: "center", pb: 2 }}>
        <Button
          variant="contained"
          color="error"
          size="small"
          sx={{ borderRadius: 5, px: 3 }}
          onClick={() => onSelect(product)}
        >
          เลือก
        </Button>
      </CardActions>
    </Card>
  );
}