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
import { CUSTOMERTYPE } from "@/app/enums/customer";
import { useCustomerProfile } from "@/app/productPage/_shared/CustomerProfileContext";
import { getDisplayPrice, getSaleTypePrices } from "../productPricing";

type ProductCardProps = {
  product: Product;
  onSelect: (product: Product, saleType: SaleType) => void;
};

const SALE_TYPE_OPTIONS: Array<{ value: SaleType; label: string }> = [
  { value: "sell", label: "ซื้อถัง" },
  { value: "exchange", label: "เปลี่ยนถัง" },
  { value: "refill", label: "ฝากเติม" }
];

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  const accentColor = getBrandAccentColor(product.brandId);
  const availableQuantity = product.availableQuantity ?? 0;
  const [saleType, setSaleType] = useState<SaleType>("sell");
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageUrl = product.imageUrl && product.imageUrl !== failedImageUrl ? product.imageUrl : null;
  const { customerType } = useCustomerProfile();
  const selectedPrice = getDisplayPrice(product, saleType, customerType);
  // บอกลูกค้าร้านค้าว่าราคานี้เป็นราคาร้านค้า (ซื้อถังหรือสินค้าที่ไม่ได้ตั้งราคาร้านค้าจะเป็นราคาปกติ)
  const isShopPrice =
    customerType === CUSTOMERTYPE.SHOP && selectedPrice !== getSaleTypePrices(product, saleType).price;
  // ฝากเติมใช้ถังของลูกค้า จึงสั่งได้แม้ถังเต็มในร้านหมด
  const isRefill = saleType === "refill";
  // สินค้าที่ร้านยังไม่ตั้งราคาฝากเติมจะไม่แสดงตัวเลือกนี้
  const saleTypeOptions = SALE_TYPE_OPTIONS.filter(
    (option) => option.value !== "refill" || getDisplayPrice(product, "refill", customerType) > 0,
  );

  return (
    <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ height: { xs: 110, sm: 140 }, p: { xs: 1, sm: 2 }, display: "flex", justifyContent: "center", bgcolor: "#f9fafb" }}>
        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={`${product.brandLabel} ${product.weightKg}กก.`}
            loading="lazy"
            onError={() => setFailedImageUrl(imageUrl)}
            sx={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <Box sx={{ width: { xs: 70, sm: 90 } }}>
            <GasCylinderGlyph accentColor={accentColor} label={product.brandLabel.charAt(0)} />
          </Box>
        )}
      </Box>
      <CardContent sx={{ flexGrow: 1, textAlign: "center", px: { xs: 1.25, sm: 2 }, pb: 0 }}>
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
          sx={{
            mt: 1,
            // การ์ดบนมือถือแคบ ลด padding เพื่อให้ "เปลี่ยนถัง" แสดงครบไม่ถูกตัด
            "& .MuiSelect-select.MuiSelect-select": {
              pl: { xs: 1, sm: 1.75 },
              pr: { xs: 3, sm: 4 },
              "@media (max-width: 319.95px)": { pl: 0.5 },
            },
          }}
        >
          {saleTypeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {isShopPrice ? "ราคาร้านค้า" : "ราคา"} : {selectedPrice.toLocaleString("th-TH")} บาท
        </Typography>
        {isRefill ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            ร้านเติมแก๊สใส่ถังเดิมของคุณ
          </Typography>
        ) : (
          <Typography variant="body2" color={availableQuantity > 0 ? "success.main" : "error.main"} sx={{ mt: 0.5, fontWeight: 600 }}>
            คงเหลือ: {availableQuantity.toLocaleString("th-TH")} ถัง
          </Typography>
        )}
      </CardContent>
      <CardActions sx={{ justifyContent: "center", px: { xs: 1.25, sm: 1 }, pb: { xs: 1.25, sm: 2 } }}>
        <Button
          variant="contained"
          color="error"
          size="small"
          sx={{ borderRadius: 5, px: 3, width: { xs: "100%", sm: "auto" } }}
          onClick={() => onSelect(product, saleType)}
          disabled={!Number.isFinite(selectedPrice) || selectedPrice <= 0 || (!isRefill && availableQuantity <= 0)}
        >
          เลือก
        </Button>
      </CardActions>
    </Card>
  );
}
