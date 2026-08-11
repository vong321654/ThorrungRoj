"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Box, Container, Paper, Typography } from "@mui/material";
import { useRequireAdmin } from "../../../useRequireAdmin";
import ProductForm, { type ProductFormValues } from "../../components/ProductForm";
import {
  getBrandList,
  getProductById,
  getTypeList,
  getUnitList,
  updateProduct,
} from "../../allFunc";
import type { PRODUCT } from "@/app/models/product";
import type { PRODUCTBAND, PRODUCTTYPE, PRODUCTUNIT } from "@/app/models/productsType";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { admin, isAllowed } = useRequireAdmin();
  const [product, setProduct] = useState<PRODUCT | null>(null);
  const [brands, setBrands] = useState<PRODUCTBAND[]>([]);
  const [types, setTypes] = useState<PRODUCTTYPE[]>([]);
  const [units, setUnits] = useState<PRODUCTUNIT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAllowed) return;
    let isCancelled = false;

    async function loadProduct() {
      const id = Number(params.id);
      if (!Number.isInteger(id) || id <= 0) {
        setMessage("รหัสสินค้าไม่ถูกต้อง");
        setIsLoading(false);
        return;
      }

      try {
        const [target, brandList, typeList, unitList] = await Promise.all([
          getProductById(id),
          getBrandList(),
          getTypeList(),
          getUnitList(),
        ]);
        if (isCancelled) return;
        setProduct(target);
        setBrands(brandList);
        setTypes(typeList);
        setUnits(unitList);
      } catch (error) {
        if (!isCancelled) {
          setMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลสินค้าได้");
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    void loadProduct();
    return () => {
      isCancelled = true;
    };
  }, [params.id, isAllowed]);

  async function handleSubmit(values: ProductFormValues) {
    if (
      !product ||
      !admin ||
      values.brandId === "" ||
      values.size === "" ||
      values.typeId === "" ||
      values.unitId === "" ||
      values.saleType === ""
    ) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      await updateProduct(product.id, {
        name: values.name,
        brandId: values.brandId,
        size: values.size,
        typeId: values.typeId,
        unitId: values.unitId,
        saleType: values.saleType,
        sellPrice: values.sellPrice,
        exchangePrice: values.exchangePrice || undefined,
        refillPrice: values.refillPrice || undefined,
        isActive: values.isActive,
        updateBy: admin.id,
      });
      router.replace("/admin/product");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ไม่สามารถบันทึกการแก้ไขได้");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isAllowed || isLoading) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>กำลังโหลดข้อมูลสินค้า...</Typography>
      </Container>
    );
  }

  if (!product) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography color="error">{message ?? "ไม่พบสินค้า"}</Typography>
        <Link href="/admin/product">กลับ</Link>
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
          แก้ไขสินค้า
        </Typography>

        <ProductForm
          mode="edit"
          initialValues={{
            name: product.name,
            brandId: product.brandId,
            size: product.size,
            typeId: product.typeId,
            unitId: product.unitId,
            saleType: product.saleType,
            sellPrice: product.sellPrice,
            exchangePrice: product.exchangePrice ?? "",
            refillPrice: product.refillPrice ?? "",
            isActive: product.isActive ?? true,
          }}
          brands={brands}
          types={types}
          units={units}
          isSubmitting={isSaving}
          message={message}
          onSubmit={handleSubmit}
        />
      </Paper>
    </Container>
  );
}
