"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Box, Container, Paper, Typography } from "@mui/material";
import { useRequireAdmin } from "../../useRequireAdmin";
import ProductForm, { type ProductFormValues } from "../components/ProductForm";
import { addProduct, getBrandList, getTypeList, getUnitList } from "../allFunc";
import type { PRODUCTBAND, PRODUCTTYPE, PRODUCTUNIT } from "@/app/models/productsType";

export default function AddProductPage() {
  const router = useRouter();
  const { admin, isAllowed } = useRequireAdmin();
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [brands, setBrands] = useState<PRODUCTBAND[]>([]);
  const [types, setTypes] = useState<PRODUCTTYPE[]>([]);
  const [units, setUnits] = useState<PRODUCTUNIT[]>([]);

  useEffect(() => {
    if (!isAllowed) return;
    let isCancelled = false;

    async function loadOptions() {
      try {
        const [brandList, typeList, unitList] = await Promise.all([
          getBrandList(),
          getTypeList(),
          getUnitList(),
        ]);
        if (isCancelled) return;
        setBrands(brandList);
        setTypes(typeList);
        setUnits(unitList);
      } catch (error) {
        if (!isCancelled) {
          setMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดตัวเลือกสินค้าได้");
        }
      } finally {
        if (!isCancelled) setIsLoadingOptions(false);
      }
    }

    void loadOptions();
    return () => {
      isCancelled = true;
    };
  }, [isAllowed]);

  async function handleSubmit(values: ProductFormValues) {
    if (
      !admin ||
      values.brandId === "" ||
      values.size === "" ||
      values.typeId === "" ||
      values.unitId === "" ||
      values.saleType === ""
    ) {
      return;
    }

    setMessage(null);
    setIsSubmitting(true);
    try {
      await addProduct({
        name: values.name,
        brandId: values.brandId,
        size: values.size,
        typeId: values.typeId,
        unitId: values.unitId,
        saleType: values.saleType,
        sellPrice: Number(values.sellPrice),
        exchangePrice: values.exchangePrice ? Number(values.exchangePrice) : 0,
        refillPrice: values.refillPrice ? Number(values.refillPrice) : 0,
        isActive: values.isActive,
        createdBy: admin.id,
        updatedBy: null,
      });

      router.replace("/admin/product");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ไม่สามารถเพิ่มสินค้าได้");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isAllowed || isLoadingOptions) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>กำลังตรวจสอบสิทธิ์...</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Box sx={{ mb: 2 }}>
        <Link href="/admin/product">← กลับไปหน้ารายการสินค้า</Link>
      </Box>

      <Paper sx={{ p: 3, maxWidth: 560 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          เพิ่มสินค้า
        </Typography>

        <ProductForm
          mode="create"
          brands={brands}
          types={types}
          units={units}
          isSubmitting={isSubmitting}
          message={message}
          onSubmit={handleSubmit}
        />
      </Paper>
    </Container>
  );
}
