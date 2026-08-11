"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import type { Product } from "@/app/productPage/_domain/entities";
import type { SaleType } from "@/app/productPage/_shared/domain/cartItem";
import { getBrandAccentColor } from "../brandTheme";
import GasCylinderGlyph from "./GasCylinderGlyph";

type ProductCardProps = {
  product: Product;
  onSelect: (product: Product, saleType: SaleType) => void;
};

const SALE_TYPE_OPTIONS: Array<{ value: SaleType; label: string }> = [
  { value: "sell", label: "ซื้อถัง" },
  { value: "exchange", label: "เปลี่ยนถัง" },
  { value: "refill", label: "เติมแก๊ส" },
];

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  const accentColor = getBrandAccentColor(product.brandId);
  const [saleType, setSaleType] = useState<SaleType>("sell");
  const selectedPrice =
    saleType === "sell"
      ? product.sellPrice
      : saleType === "exchange"
        ? product.exchangePrice
        : product.refillPrice;

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
        <TextField
          select
          fullWidth
          size="small"
          label="รูปแบบการซื้อ"
          value={saleType}
          onChange={(event) => setSaleType(event.target.value as SaleType)}
          sx={{ mt: 1 }}
        >
          {SALE_TYPE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          ราคา : {selectedPrice.toLocaleString("th-TH")} บาท
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: "center", pb: 2 }}>
        <Button
          variant="contained"
          color="error"
          size="small"
          sx={{ borderRadius: 5, px: 3 }}
          onClick={() => onSelect(product, saleType)}
          disabled={!Number.isFinite(selectedPrice) || selectedPrice <= 0}
        >
          เลือก
        </Button>
      </CardActions>
    </Card>
  );
}
