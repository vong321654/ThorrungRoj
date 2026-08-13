"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { ApiResult } from "@/app/api/response";
import { useRequireAdmin } from "../useRequireAdmin";

type DebtTypeChoice = "money" | "cart" | "both";
type OrderOption = { id: string; totalAmount: number | string; status: string; users: { name: string; shopName: string | null } | null };
type DebtRecord = {
  id: string; debtType: "money" | "cart"; amount: number | string; status: "pending" | "partial" | "paid"; createdAt: string;
  users: { name: string; phone: string | null; shopName: string | null } | null;
  products: { name: string; size: number | string | null } | null;
  debtTransactions: Array<{ id: string; transactionType: "payment" | "return"; amount: number | string; createdAt: string }>;
};

function formatAmount(value: number, debtType: DebtRecord["debtType"]) {
  return debtType === "money" ? `${value.toLocaleString("th-TH")} บาท` : `${value.toLocaleString("th-TH")} ถัง`;
}

export default function AdminDebtsPage() {
  const { isAllowed } = useRequireAdmin();
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [debtType, setDebtType] = useState<DebtTypeChoice>("money");
  const [note, setNote] = useState("");
  const [settlingDebt, setSettlingDebt] = useState<DebtRecord | null>(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const request = useCallback(async function request<T>(path: string, options: RequestInit = {}) {
    const { data } = await createClient().auth.getSession();
    const response = await fetch(path, {
      ...options,
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}`, ...options.headers },
    });
    const result = await response.json() as ApiResult<T>;
    if (!response.ok || result.status === "error") throw new Error(result.message);
    return result.results;
  }, []);

  const loadData = useCallback(async function loadData() {
    const [debtData, orderData] = await Promise.all([
      request<DebtRecord[]>("/api/admin/debts"),
      request<OrderOption[]>("/api/admin/orders"),
    ]);
    setDebts(debtData);
    setOrders(orderData.filter((order) => order.status === "delivered"));
  }, [request]);

  useEffect(() => {
    if (!isAllowed) return;
    void loadData().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดข้อมูลหนี้ได้")).finally(() => setIsLoading(false));
  }, [isAllowed, loadData]);

  async function createDebt() {
    if (!selectedOrderId) return;
    setIsSaving(true);
    setError(null);
    try {
      await request("/api/admin/debts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: selectedOrderId, debtType, note }) });
      setSelectedOrderId("");
      setNote("");
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ไม่สามารถบันทึกรายการหนี้ได้");
    } finally {
      setIsSaving(false);
    }
  }

  async function settleDebt() {
    if (!settlingDebt) return;
    setIsSaving(true);
    setError(null);
    try {
      await request(`/api/admin/debts?id=${encodeURIComponent(settlingDebt.id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(settlementAmount) }) });
      setSettlingDebt(null);
      setSettlementAmount("");
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ไม่สามารถบันทึกรายการได้");
    } finally {
      setIsSaving(false);
    }
  }

  return <Box sx={{ p: { xs: 2, md: 4 } }}>
    <Button component={Link} href="/admin" sx={{ mb: 2 }}>← กลับ Dashboard</Button>
    <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>จัดการหนี้ค้างเงินและค้างถัง</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>บันทึกรายการค้างจากออเดอร์ที่จัดส่งแล้ว</Typography>
      <Stack spacing={2} direction={{ xs: "column", md: "row" }}>
        <FormControl fullWidth><InputLabel id="debt-order-label">ออเดอร์</InputLabel><Select labelId="debt-order-label" label="ออเดอร์" value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}>{orders.map((order) => <MenuItem key={order.id} value={order.id}>{order.users?.shopName || order.users?.name || "ลูกค้า"} — {Number(order.totalAmount).toLocaleString("th-TH")} บาท</MenuItem>)}</Select></FormControl>
        <FormControl fullWidth><InputLabel id="debt-type-label">ประเภทค้าง</InputLabel><Select labelId="debt-type-label" label="ประเภทค้าง" value={debtType} onChange={(event) => setDebtType(event.target.value as DebtTypeChoice)}><MenuItem value="money">ค้างเงิน</MenuItem><MenuItem value="cart">ค้างถัง</MenuItem><MenuItem value="both">ค้างทั้งเงินและถัง</MenuItem></Select></FormControl>
        <TextField fullWidth label="หมายเหตุ" value={note} onChange={(event) => setNote(event.target.value)} />
        <Button variant="contained" onClick={() => void createDebt()} disabled={!selectedOrderId || isSaving} sx={{ minWidth: 130 }}>บันทึกหนี้</Button>
      </Stack>
    </Paper>

    {isLoading ? <CircularProgress /> : <TableContainer component={Paper}><Table><TableHead><TableRow><TableCell>ลูกค้า</TableCell><TableCell>ประเภท</TableCell><TableCell>สินค้า</TableCell><TableCell>ชำระ/คืนแล้ว</TableCell><TableCell>ยอดทั้งหมด</TableCell><TableCell>คงเหลือ</TableCell><TableCell>สถานะ</TableCell><TableCell>จัดการ</TableCell></TableRow></TableHead><TableBody>{debts.map((debt) => {
      const settled = debt.debtTransactions.reduce((total, transaction) => total + Number(transaction.amount), 0);
      const total = Number(debt.amount);
      const remaining = Math.max(0, total - settled);
      return <TableRow key={debt.id}><TableCell>{debt.users?.shopName || debt.users?.name || "-"}</TableCell><TableCell>{debt.debtType === "money" ? "ค้างเงิน" : "ค้างถัง"}</TableCell><TableCell>{debt.products ? `${debt.products.name}${debt.products.size ? ` ${debt.products.size} กก.` : ""}` : "-"}</TableCell><TableCell>{formatAmount(settled, debt.debtType)}</TableCell><TableCell>{formatAmount(total, debt.debtType)}</TableCell><TableCell>{formatAmount(remaining, debt.debtType)}</TableCell><TableCell><Chip size="small" color={debt.status === "paid" ? "success" : debt.status === "partial" ? "warning" : "default"} label={debt.status === "paid" ? "ครบแล้ว" : debt.status === "partial" ? "ชำระบางส่วน" : "ค้าง"} /></TableCell><TableCell><Button size="small" variant="outlined" disabled={remaining === 0} onClick={() => { setSettlingDebt(debt); setSettlementAmount(""); }}>{debt.debtType === "money" ? "รับชำระ" : "รับคืนถัง"}</Button></TableCell></TableRow>;
    })}{debts.length === 0 && <TableRow><TableCell colSpan={8} align="center">ยังไม่มีรายการหนี้</TableCell></TableRow>}</TableBody></Table></TableContainer>}

    <Dialog open={!!settlingDebt} onClose={() => !isSaving && setSettlingDebt(null)} fullWidth maxWidth="xs"><DialogTitle>{settlingDebt?.debtType === "money" ? "บันทึกรับชำระเงิน" : "บันทึกรับคืนถัง"}</DialogTitle><DialogContent><TextField autoFocus fullWidth sx={{ mt: 1 }} type="number" slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} label={settlingDebt?.debtType === "money" ? "จำนวนเงิน" : "จำนวนถัง"} value={settlementAmount} onChange={(event) => setSettlementAmount(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setSettlingDebt(null)} disabled={isSaving}>ยกเลิก</Button><Button variant="contained" onClick={() => void settleDebt()} disabled={isSaving || !settlementAmount}>บันทึก</Button></DialogActions></Dialog>
  </Box>;
}
