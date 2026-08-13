"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { ApiResult } from "@/app/api/response";
import type { PRODUCT } from "@/app/models/product";
import { useRequireAdmin } from "../useRequireAdmin";

type InventoryItem = {
  id: string; productId: number; stockStatus: "full" | "empty" | "damaged" | null; itemCondition: "new" | "old" | "normal"; quantityOnHand: number; quantityReserved: number; quantityAvailable: number; minimumStock: number; createdAt: string;
  products: { id: number; name: string; size: number | string | null } | null;
};

export default function AdminInventoryPage() {
  const { isAllowed } = useRequireAdmin();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<PRODUCT[]>([]);
  const [productId, setProductId] = useState("");
  const [stockStatus, setStockStatus] = useState<InventoryItem["stockStatus"]>("full");
  const [itemCondition, setItemCondition] = useState<InventoryItem["itemCondition"]>("normal");
  const [quantity, setQuantity] = useState("");
  const [minimumStock, setMinimumStock] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editMinimumStock, setEditMinimumStock] = useState("");
  const [editStockStatus, setEditStockStatus] = useState<InventoryItem["stockStatus"]>("full");
  const [editItemCondition, setEditItemCondition] = useState<InventoryItem["itemCondition"]>("normal");
  const [editNote, setEditNote] = useState("");

  const request = useCallback(async <T,>(url: string, options: RequestInit = {}) => {
    const { data } = await createClient().auth.getSession();
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}`, ...options.headers } });
    const result = await response.json() as ApiResult<T>;
    if (!response.ok || result.status === "error") throw new Error(result.message);
    return result.results;
  }, []);

  const loadData = useCallback(async () => {
    const [inventory, productList] = await Promise.all([request<InventoryItem[]>("/api/inventory"), request<PRODUCT[]>("/api/product")]);
    setItems(inventory); setProducts(productList.filter((product) => product.isActive));
  }, [request]);

  useEffect(() => { if (isAllowed) void loadData().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดคลังสินค้าได้")).finally(() => setIsLoading(false)); }, [isAllowed, loadData]);

  async function addItem() {
    setIsSaving(true); setError(null);
    try {
      if (isGasCylinder && !stockStatus) throw new Error("กรุณาเลือกสถานะถังแก๊ส");
      await request("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: Number(productId), stockStatus, itemCondition, quantityOnHand: Number(quantity), minimumStock: Number(minimumStock), note }) });
      setProductId(""); setQuantity(""); setMinimumStock("0"); setNote(""); await loadData();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "ไม่สามารถเพิ่มสต็อกได้"); }
    finally { setIsSaving(false); }
  }

  async function deleteItem(item: InventoryItem) {
    if (!window.confirm("ลบรายการสต็อกนี้หรือไม่? ลบได้เฉพาะรายการที่ยังไม่ผูกกับออเดอร์")) return;
    setDeletingId(item.id); setError(null);
    try { await request(`/api/inventory?id=${encodeURIComponent(item.id)}`, { method: "DELETE" }); await loadData(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "ไม่สามารถลบรายการสต็อกได้"); }
    finally { setDeletingId(null); }
  }

  function openEdit(item: InventoryItem) {
    setEditingItem(item); setEditQuantity(String(item.quantityOnHand)); setEditMinimumStock(String(item.minimumStock)); setEditStockStatus(item.stockStatus); setEditItemCondition(item.itemCondition); setEditNote("");
  }

  const isGasCylinder = products.find((product) => String(product.id) === productId)?.typeId === 14;
  const isEditingGasCylinder = editingItem ? products.find((product) => product.id === editingItem.productId)?.typeId === 14 : false;

  async function saveEdit() {
    if (!editingItem) return;
    setIsSaving(true); setError(null);
    try {
      if (isEditingGasCylinder && !editStockStatus) throw new Error("กรุณาเลือกสถานะถังแก๊ส");
      await request(`/api/inventory?id=${encodeURIComponent(editingItem.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stockStatus: editStockStatus, itemCondition: editItemCondition, quantityOnHand: Number(editQuantity), minimumStock: Number(editMinimumStock), note: editNote }) });
      setEditingItem(null); await loadData();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "ไม่สามารถแก้ไขสต็อกได้"); }
    finally { setIsSaving(false); }
  }

  return <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
    <Button component={Link} href="/admin" sx={{ mb: 2 }}>← กลับ Dashboard</Button>
    <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>จัดการคลังสินค้า</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Paper sx={{ p: 3, mb: 3 }}><Typography variant="h6" sx={{ mb: 2 }}>เพิ่มรายการสต็อก</Typography><Stack spacing={2} direction={{ xs: "column", md: "row" }}>
      <Select displayEmpty fullWidth value={productId} onChange={(event) => { const nextId = event.target.value; setProductId(nextId); setStockStatus(products.find((product) => String(product.id) === nextId)?.typeId === 14 ? "full" : null); }}><MenuItem value="" disabled>เลือกสินค้า</MenuItem>{products.map((product) => <MenuItem key={product.id} value={String(product.id)}>{product.name} {product.size ? `${product.size} กก.` : ""}</MenuItem>)}</Select>
      <Select fullWidth value={itemCondition} onChange={(event) => setItemCondition(event.target.value as InventoryItem["itemCondition"])}><MenuItem value="new">ใหม่</MenuItem><MenuItem value="old">เก่า</MenuItem><MenuItem value="normal">ปกติ</MenuItem></Select>
      <Select fullWidth displayEmpty value={stockStatus ?? ""} onChange={(event) => setStockStatus(event.target.value ? event.target.value as InventoryItem["stockStatus"] : null)}><MenuItem value="">{isGasCylinder ? "เลือกสถานะถังแก๊ส" : "ไม่ระบุสถานะ"}</MenuItem><MenuItem value="full">ถังเต็ม</MenuItem><MenuItem value="empty">ถังเปล่า</MenuItem><MenuItem value="damaged">ชำรุด</MenuItem></Select>
      <TextField fullWidth label="จำนวน" type="number" slotProps={{ htmlInput: { min: 1, step: 1 } }} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      <TextField fullWidth label="สต็อกขั้นต่ำ" type="number" slotProps={{ htmlInput: { min: 0, step: 1 } }} value={minimumStock} onChange={(event) => setMinimumStock(event.target.value)} />
      <TextField fullWidth label="หมายเหตุ" value={note} onChange={(event) => setNote(event.target.value)} />
      <Button variant="contained" disabled={!productId || Number(quantity) <= 0 || isSaving} onClick={() => void addItem()} sx={{ minWidth: 110 }}>เพิ่มสต็อก</Button>
    </Stack></Paper>
    {isLoading ? <CircularProgress /> : <TableContainer component={Paper}><Table><TableHead><TableRow><TableCell>สินค้า</TableCell><TableCell>สภาพ</TableCell><TableCell>สถานะ</TableCell><TableCell>คงคลัง</TableCell><TableCell>จองแล้ว</TableCell><TableCell>พร้อมขาย</TableCell><TableCell>ขั้นต่ำ</TableCell><TableCell>เพิ่มเมื่อ</TableCell><TableCell>จัดการ</TableCell></TableRow></TableHead><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell>{item.products?.name || `สินค้า #${item.productId}`}{item.products?.size ? ` ${item.products.size} กก.` : ""}</TableCell><TableCell>{item.itemCondition === "new" ? "ใหม่" : item.itemCondition === "old" ? "เก่า" : "ปกติ"}</TableCell><TableCell>{item.stockStatus === "full" ? "ถังเต็ม" : item.stockStatus === "empty" ? "ถังเปล่า" : item.stockStatus === "damaged" ? "ชำรุด" : "-"}</TableCell><TableCell>{item.quantityOnHand}</TableCell><TableCell>{item.quantityReserved}</TableCell><TableCell>{item.quantityAvailable}</TableCell><TableCell>{item.minimumStock}</TableCell><TableCell>{new Date(item.createdAt).toLocaleString("th-TH")}</TableCell><TableCell><Button size="small" onClick={() => openEdit(item)}>แก้ไข</Button><Button size="small" color="error" disabled={deletingId === item.id} onClick={() => void deleteItem(item)}>{deletingId === item.id ? "กำลังลบ..." : "ลบ"}</Button></TableCell></TableRow>)}{items.length === 0 && <TableRow><TableCell colSpan={9} align="center">ยังไม่มีรายการสต็อก</TableCell></TableRow>}</TableBody></Table></TableContainer>}
    <Dialog open={!!editingItem} onClose={() => !isSaving && setEditingItem(null)} fullWidth maxWidth="xs"><DialogTitle>แก้ไขรายการสต็อก</DialogTitle><DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}><Select value={editItemCondition} onChange={(event) => setEditItemCondition(event.target.value as InventoryItem["itemCondition"])}><MenuItem value="new">ใหม่</MenuItem><MenuItem value="old">เก่า</MenuItem><MenuItem value="normal">ปกติ</MenuItem></Select><Select displayEmpty value={editStockStatus ?? ""} onChange={(event) => setEditStockStatus(event.target.value ? event.target.value as InventoryItem["stockStatus"] : null)}><MenuItem value="">{isEditingGasCylinder ? "เลือกสถานะถังแก๊ส" : "ไม่ระบุสถานะ"}</MenuItem><MenuItem value="full">ถังเต็ม</MenuItem><MenuItem value="empty">ถังเปล่า</MenuItem><MenuItem value="damaged">ชำรุด</MenuItem></Select><TextField label="จำนวนคงคลัง" type="number" slotProps={{ htmlInput: { min: editingItem?.quantityReserved ?? 0, step: 1 } }} value={editQuantity} onChange={(event) => setEditQuantity(event.target.value)} /><TextField label="สต็อกขั้นต่ำ" type="number" slotProps={{ htmlInput: { min: 0, step: 1 } }} value={editMinimumStock} onChange={(event) => setEditMinimumStock(event.target.value)} /><TextField label="หมายเหตุการปรับสต็อก" value={editNote} onChange={(event) => setEditNote(event.target.value)} multiline minRows={2} /></DialogContent><DialogActions><Button disabled={isSaving} onClick={() => setEditingItem(null)}>ยกเลิก</Button><Button variant="contained" disabled={isSaving || Number(editQuantity) < (editingItem?.quantityReserved ?? 0) || Number(editMinimumStock) < 0 || (isEditingGasCylinder && !editStockStatus)} onClick={() => void saveEdit()}>บันทึก</Button></DialogActions></Dialog>
  </Box>;
}
