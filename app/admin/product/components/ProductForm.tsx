"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { uploadProductImage } from "../allFunc";
import type { PRODUCTBAND, PRODUCTTYPE, PRODUCTUNIT } from "@/app/models/productsType";

// ต้องตรงกับเงื่อนไขใน app/api/images/route.ts
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  // undefined = ผู้ใช้ไม่มีสิทธิ์แก้รูป จึงไม่ส่ง imageUrl ไปกับ payload เลย
  imageUrl?: string | null;
};

type ProductFormProps = {
  mode: "create" | "edit";
  initialValues?: Partial<ProductFormValues>;
  initialImageUrl?: string | null;
  canUploadImage?: boolean;
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
  initialImageUrl,
  canUploadImage = false,
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
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // อัปโหลดทันทีที่เลือกไฟล์ แล้วเก็บ imageUrl ที่ API คืนมาไว้ส่งพร้อมข้อมูลสินค้า
  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    // reset เพื่อให้เลือกไฟล์เดิมซ้ำได้ ถ้าอัปโหลดรอบก่อนพลาด
    event.target.value = "";
    if (!file) return;

    if (!IMAGE_TYPES.includes(file.type)) {
      setValidationMessage("รูปสินค้าต้องเป็นไฟล์ JPG, PNG หรือ WebP เท่านั้น");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setValidationMessage("รูปสินค้าต้องมีขนาดไม่เกิน 5 MB");
      return;
    }

    setValidationMessage(null);
    setIsUploading(true);
    try {
      setUploadedImageUrl(await uploadProductImage(file));
    } catch (error) {
      setValidationMessage(
        error instanceof Error ? `อัปโหลดรูปไม่สำเร็จ: ${error.message}` : "อัปโหลดรูปไม่สำเร็จ",
      );
    } finally {
      setIsUploading(false);
    }
  }

  const displayedImageUrl = uploadedImageUrl ?? initialImageUrl ?? null;

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
      ...(canUploadImage ? { imageUrl: displayedImageUrl } : {}),
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

        {canUploadImage && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              รูปสินค้า
            </Typography>
            <Box
              sx={{
                height: 160,
                mb: 1,
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "#f9fafb",
                overflow: "hidden",
              }}
            >
              {isUploading ? (
                <CircularProgress size={28} />
              ) : displayedImageUrl ? (
                <Box
                  component="img"
                  src={displayedImageUrl}
                  alt="ตัวอย่างรูปสินค้า"
                  sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  ยังไม่มีรูปสินค้า
                </Typography>
              )}
            </Box>
            <Button
              component="label"
              variant="outlined"
              size="small"
              disabled={isSubmitting || isUploading}
            >
              {isUploading ? "กำลังอัปโหลด..." : displayedImageUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
              <input
                hidden
                type="file"
                accept={IMAGE_TYPES.join(",")}
                onChange={(event) => void handleImageChange(event)}
              />
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              {uploadedImageUrl
                ? "อัปโหลดรูปแล้ว กดบันทึกเพื่อผูกรูปกับสินค้า"
                : "JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB (ไม่บังคับ)"}
            </Typography>
          </Box>
        )}
        <FormControlLabel
          control={
            <Checkbox checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          }
          label="เปิดใช้งาน"
        />

        <Button type="submit" variant="contained" disabled={isSubmitting || isUploading}>
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
