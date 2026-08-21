"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { ADMINROLE } from "@/app/models/admin";
import { useRequireAdmin } from "../useRequireAdmin";
import { deleteProduct, getBrandList, getProductList, getTypeList, getUnitList } from "./allFunc";
import type { PRODUCT } from "@/app/models/product";
import type { PRODUCTBAND, PRODUCTTYPE, PRODUCTUNIT } from "@/app/models/productsType";

const ROWS_PER_PAGE = 10;

export default function ProductPage() {
  const { admin, isAllowed } = useRequireAdmin();
  const isSuperAdmin = admin?.role === ADMINROLE.SUPER_ADMIN;
  const [products, setProducts] = useState<PRODUCT[]>([]);
  const [brands, setBrands] = useState<PRODUCTBAND[]>([]);
  const [types, setTypes] = useState<PRODUCTTYPE[]>([]);
  const [units, setUnits] = useState<PRODUCTUNIT[]>([]);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadData() {
    try {
      const [productList, brandList, typeList, unitList] = await Promise.all([
        getProductList(),
        getBrandList(),
        getTypeList(),
        getUnitList(),
      ]);
      setProducts(productList);
      setBrands(brandList);
      setTypes(typeList);
      setUnits(unitList);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลสินค้าได้");
    }
  }

  useEffect(() => {
    if (!isAllowed) return;
    let isCancelled = false;

    async function init() {
      await loadData();
      if (!isCancelled) setIsLoading(false);
    }

    void init();
    return () => {
      isCancelled = true;
    };
  }, [isAllowed]);

  const brandName = (id: number) => brands.find((b) => b.id === id)?.name ?? "-";
  const typeName = (id: number) => types.find((t) => t.id === id)?.name ?? "-";
  const unitName = (id: number) => units.find((u) => u.id === id)?.unit ?? "-";
  const filteredProducts = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(keyword) ||
        brandName(product.brandId).toLowerCase().includes(keyword)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, searchText, brands]);

  const totalCount = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ROWS_PER_PAGE));
  const pageItems = filteredProducts.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  function handleSearchChange(value: string) {
    setSearchText(value);
    setPage(1);
  }

  function handleChangePage(_event: ChangeEvent<unknown>, value: number) {
    setPage(value);
  }

  async function handleDeleteClick(id: number) {
    if (!window.confirm("ต้องการลบสินค้านี้ใช่หรือไม่?")) return;
    try {
      await deleteProduct(id);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถลบสินค้าได้");
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>กำลังโหลดข้อมูลสินค้า...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5">รายการสินค้า</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {isSuperAdmin && (
            <>
              <Button component={Link} href="/admin/product/brand" variant="outlined">
                จัดการแบรนด์
              </Button>
              <Button component={Link} href="/admin/product/type" variant="outlined">
                จัดการประเภท
              </Button>
              <Button component={Link} href="/admin/product/unit" variant="outlined">
                จัดการหน่วย
              </Button>
            </>
          )}
          <Button
            component={Link}
            href="/admin/product/addProduct"
            variant="contained"
            startIcon={<AddIcon />}
          >
            เพิ่มสินค้า
          </Button>
        </Box>
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <TextField
          label="ค้นหาสินค้า"
          placeholder="ค้นหาจากชื่อสินค้าหรือแบรนด์"
          value={searchText}
          onChange={(event) => handleSearchChange(event.target.value)}
          fullWidth
        />
      </Box>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} size="medium" aria-label="product table">
          <TableHead sx={{ fontWeight: "bold" }}>
            <TableRow>
              <TableCell align="left">ชื่อสินค้า</TableCell>
              <TableCell align="left">แบรนด์</TableCell>
              <TableCell align="left">ขนาด</TableCell>
              <TableCell align="left">ประเภท</TableCell>
              <TableCell align="left">หน่วย</TableCell>
              <TableCell align="left">ราคาขาย</TableCell>
              <TableCell align="left">สถานะ</TableCell>
              <TableCell align="left">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageItems.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {product.name}
                  </Box>
                </TableCell>
                <TableCell align="left">{brandName(product.brandId)}</TableCell>
                <TableCell align="left">{product.size}</TableCell>
                <TableCell align="left">{typeName(product.typeId)}</TableCell>
                <TableCell align="left">{unitName(product.unitId)}</TableCell>
                <TableCell align="left">{product.sellPrice}</TableCell>
                <TableCell align="left">{product.isActive === false ? "ปิดใช้งาน" : "ใช้งาน"}</TableCell>
                <TableCell align="left">
                  <Link href={`/admin/product/editProduct/${product.id}`}>
                    <IconButton sx={{ color: "black" }}>
                      <EditIcon />
                    </IconButton>
                  </Link>
                  <IconButton color="inherit" onClick={() => void handleDeleteClick(product.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  ไม่พบสินค้า
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            mt: 1,
            mb: 1,
            mr: 2,
            position: "relative",
          }}
        >
          <Pagination count={totalPages} page={page} onChange={handleChangePage} showFirstButton showLastButton />
          <Typography sx={{ position: "absolute", right: 0 }}>
            {totalCount === 0
              ? "0 จาก 0 แถว"
              : `${(page - 1) * ROWS_PER_PAGE + 1}-${Math.min(page * ROWS_PER_PAGE, totalCount)} จาก ${totalCount} แถว`}
          </Typography>
        </Box>
      </TableContainer>
    </Box>
  );
}
