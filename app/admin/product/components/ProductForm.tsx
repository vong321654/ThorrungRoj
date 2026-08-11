"use client";

import { type FormEvent, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import type { PRODUCTBAND, PRODUCTTYPE, PRODUCTUNIT } from "@/app/models/productsType";

export type ProductFormValues = {
  name: string;
  brandId: number | "";
  size: number | "";
  typeId: number | "";
  unitId: number | "";
  sellPrice: string;
  exchangePrice: string;
  refillPrice: string;
  isActive: boolean;
};

type ProductFormProps = {
  mode: "create" | "edit";
  initialValues?: Partial<ProductFormValues>;
  brands: PRODUCTBAND[];
  types: PRODUCTTYPE[];
  units: PRODUCTUNIT[];
  isSubmitting: boolean;
  message: string | null;
  onSubmit: (values: ProductFormValues) => Promise<void>;
};

export default function ProductForm({
  mode,
  initialValues,
  brands,
  types,
  units,
  isSubmitting,
  message,
  onSubmit,
}: ProductFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [brandId, setBrandId] = useState<number | "">(initialValues?.brandId ?? "");
  const [size, setSize] = useState<number | "">(initialValues?.size ?? "");
  const [typeId, setTypeId] = useState<number | "">(initialValues?.typeId ?? "");
  const [unitId, setUnitId] = useState<number | "">(initialValues?.unitId ?? "");
  const [sellPrice, setSellPrice] = useState(initialValues?.sellPrice ?? "");
  const [exchangePrice, setExchangePrice] = useState(initialValues?.exchangePrice ?? "");
  const [refillPrice, setRefillPrice] = useState(initialValues?.refillPrice ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationMessage(null);

    if (
      !name.trim() ||
      brandId === "" ||
      size === "" ||
      typeId === "" ||
      unitId === "" ||
      !sellPrice.trim()
    ) {
      setValidationMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    await onSubmit({
      name: name.trim(),
      brandId,
      size,
      typeId,
      unitId,
      sellPrice: sellPrice.trim(),
      exchangePrice: exchangePrice.trim(),
      refillPrice: refillPrice.trim(),
      isActive,
    });
  }

  const displayedMessage = validationMessage ?? message;

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {displayedMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {displayedMessage}
        </Alert>
      )}

      <Stack spacing={2}>
        <TextField
          label="ชื่อสินค้า"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          fullWidth
        />

        <TextField
          select
          label="แบรนด์"
          value={brandId}
          onChange={(event) => setBrandId(Number(event.target.value))}
          required
          fullWidth
        >
          {brands.map((brand) => (
            <MenuItem key={brand.id} value={brand.id}>
              {brand.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="ขนาด"
          type="number"
          value={size}
          onChange={(event) => setSize(event.target.value === "" ? "" : Number(event.target.value))}
          required
          fullWidth
        />

        <TextField
          select
          label="ประเภท"
          value={typeId}
          onChange={(event) => setTypeId(Number(event.target.value))}
          required
          fullWidth
        >
          {types.map((type) => (
            <MenuItem key={type.id} value={type.id}>
              {type.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="หน่วย"
          value={unitId}
          onChange={(event) => setUnitId(Number(event.target.value))}
          required
          fullWidth
        >
          {units.map((unit) => (
            <MenuItem key={unit.id} value={unit.id}>
              {unit.unit}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="ราคาขาย"
          value={sellPrice}
          onChange={(event) => setSellPrice(event.target.value)}
          required
          fullWidth
        />

        <TextField
          label="ราคาแลก"
          value={exchangePrice}
          onChange={(event) => setExchangePrice(event.target.value)}
          fullWidth
        />

        <TextField
          label="ราคาเติม"
          value={refillPrice}
          onChange={(event) => setRefillPrice(event.target.value)}
          fullWidth
        />

        <FormControlLabel
          control={
            <Checkbox checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          }
          label="เปิดใช้งาน"
        />

        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting
            ? mode === "create"
              ? "กำลังเพิ่มสินค้า..."
              : "กำลังบันทึก..."
            : mode === "create"
              ? "เพิ่มสินค้า"
              : "บันทึกการแก้ไข"}
        </Button>
      </Stack>
    </Box>
  );
}
