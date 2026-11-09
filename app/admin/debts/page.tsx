"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import { ADMINROLE } from "@/app/models/admin";
import { useRequireAdmin, MANAGER_ONLY } from "../useRequireAdmin";

type DebtTypeChoice = "money" | "cart" | "both";
type DebtFilter = "all" | DebtTypeChoice;
type TankProduct = { id: number; name: string; size: number | string | null; typeId: number; isActive: boolean };
type ManualDebtForm = { name: string; address: string; phone: string; debtType: DebtTypeChoice; moneyAmount: string; productId: string; cartQuantity: string; note: string };
type DebtRecord = {
  id: string; userId: string; orderId: string | null; debtType: "money" | "cart"; amount: number | string; status: "pending" | "partial" | "paid"; createdAt: string;
  users: { name: string; phone: string | null; shopName: string | null } | null;
  products: { name: string; size: number | string | null } | null;
  debtTransactions: Array<{ id: string; transactionType: "payment" | "return"; amount: number | string; createdAt: string }>;
};

const TANK_TYPE_ID = 14; // "ถังแก๊ส" ใน productsType
const EMPTY_MANUAL_FORM: ManualDebtForm = { name: "", address: "", phone: "", debtType: "money", moneyAmount: "", productId: "", cartQuantity: "", note: "" };

function formatAmount(value: number, debtType: DebtRecord["debtType"]) {
  return debtType === "money" ? `${value.toLocaleString("th-TH")} บาท` : `${value.toLocaleString("th-TH")} ถัง`;
}

// หนี้ที่บันทึกพร้อมกันนับเป็นชุดเดียว: ใช้ออเดอร์ ถ้าไม่มีออเดอร์ (โทรสั่ง) ใช้ลูกค้า + เวลาบันทึก
function debtGroupKey(debt: DebtRecord) {
  return debt.orderId ?? `${debt.userId}|${debt.createdAt}`;
}

export default function AdminDebtsPage() {
  const { admin, isAllowed } = useRequireAdmin(MANAGER_ONLY);
  const isSuperAdmin = admin?.role === ADMINROLE.SUPER_ADMIN;
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [tankProducts, setTankProducts] = useState<TankProduct[]>([]);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState<ManualDebtForm>(EMPTY_MANUAL_FORM);
  const [manualError, setManualError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DebtFilter>("all");
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
    const result = await response.json() as APIRESULT<T>;
    if (!response.ok || result.status === "error") throw new Error(result.message);
    return result.results;
  }, []);

  const loadData = useCallback(async function loadData() {
    const [debtData, productData] = await Promise.all([
      request<DebtRecord[]>("/api/admin/debts"),
      request<TankProduct[]>("/api/product"),
    ]);
    setDebts(debtData);
    setTankProducts(productData.filter((product) => product.typeId === TANK_TYPE_ID && product.isActive));
  }, [request]);

  useEffect(() => {
    if (!isAllowed) return;
    void loadData().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดข้อมูลหนี้ได้")).finally(() => setIsLoading(false));
  }, [isAllowed, loadData]);

  // ชุดหนี้ (ออเดอร์หรือการบันทึกเดียวกัน) ที่มีทั้งค้างเงินและค้างถัง
  const moneyGroups = new Set(debts.filter((debt) => debt.debtType === "money").map(debtGroupKey));
  const bothGroups = new Set(debts.filter((debt) => debt.debtType === "cart" && moneyGroups.has(debtGroupKey(debt))).map(debtGroupKey));
  const filterCounts: Record<DebtFilter, number> = {
    all: debts.length,
    money: debts.filter((debt) => debt.debtType === "money").length,
    cart: debts.filter((debt) => debt.debtType === "cart").length,
    both: debts.filter((debt) => bothGroups.has(debtGroupKey(debt))).length,
  };
  const visibleDebts = debts.filter((debt) => {
    if (filter === "all") return true;
    if (filter === "both") return bothGroups.has(debtGroupKey(debt));
    return debt.debtType === filter;
  });

  const needsMoney = manualForm.debtType === "money" || manualForm.debtType === "both";
  const needsCart = manualForm.debtType === "cart" || manualForm.debtType === "both";
  const canSaveManual = !!manualForm.name.trim() && !!manualForm.phone.trim()
    && (!needsMoney || Number(manualForm.moneyAmount) > 0)
    && (!needsCart || (!!manualForm.productId && Number(manualForm.cartQuantity) > 0));

  function updateManualForm<K extends keyof ManualDebtForm>(field: K, value: ManualDebtForm[K]) {
    setManualForm((current) => ({ ...current, [field]: value }));
  }

  function openManualDialog() {
    setManualForm(EMPTY_MANUAL_FORM);
    setManualError(null);
    setIsManualOpen(true);
  }

  async function createManualDebt() {
    setIsSaving(true);
    setManualError(null);
    try {
      await request("/api/admin/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: manualForm.name, address: manualForm.address, phone: manualForm.phone },
          debtType: manualForm.debtType,
          moneyAmount: needsMoney ? Number(manualForm.moneyAmount) : undefined,
          productId: needsCart ? Number(manualForm.productId) : undefined,
          cartQuantity: needsCart ? Number(manualForm.cartQuantity) : undefined,
          note: manualForm.note,
        }),
      });
      setIsManualOpen(false);
      await loadData();
    } catch (saveError) {
      setManualError(saveError instanceof Error ? saveError.message : "ไม่สามารถบันทึกรายการหนี้ได้");
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
    <Button component={Link} href="/admin" sx={{ mb: 2 }}>← กลับหน้าจัดการระบบ</Button>
    <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>จัดการหนี้ค้างเงินและค้างถัง</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    {isSuperAdmin && <Paper sx={{ p: 3, mb: 3 }}>
      <Stack spacing={2} direction={{ xs: "column", md: "row" }} sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h6">บันทึกหนี้ค้างจากการสั่งทางโทรศัพท์</Typography>
          <Typography variant="body2" color="text.secondary">ออเดอร์ผ่านหน้าเว็บ ระบบบันทึกหนี้ให้อัตโนมัติเมื่อยืนยันจัดส่งแล้ว ใช้ปุ่มนี้เฉพาะลูกค้าที่โทรสั่งกับเจ้าของร้าน</Typography>
        </Box>
        <Button variant="contained" onClick={openManualDialog} sx={{ minWidth: 130 }}>บันทึกหนี้</Button>
      </Stack>
    </Paper>}

    <Paper sx={{ mb: 2 }}>
      <Tabs value={filter} onChange={(_, value: DebtFilter) => setFilter(value)} variant="scrollable" allowScrollButtonsMobile>
        <Tab value="all" label={`ทั้งหมด (${filterCounts.all})`} />
        <Tab value="money" label={`ค้างเงิน (${filterCounts.money})`} />
        <Tab value="cart" label={`ค้างถัง (${filterCounts.cart})`} />
        <Tab value="both" label={`ค้างทั้งเงินและถัง (${filterCounts.both})`} />
      </Tabs>
    </Paper>

    {isLoading ? <CircularProgress /> : <TableContainer component={Paper}><Table><TableHead><TableRow><TableCell>ลูกค้า</TableCell><TableCell>ประเภท</TableCell><TableCell>สินค้า</TableCell><TableCell>ชำระ/คืนแล้ว</TableCell><TableCell>ยอดทั้งหมด</TableCell><TableCell>คงเหลือ</TableCell><TableCell>สถานะ</TableCell><TableCell>ออเดอร์</TableCell><TableCell>จัดการ</TableCell></TableRow></TableHead><TableBody>{visibleDebts.map((debt) => {
      const settled = debt.debtTransactions.reduce((total, transaction) => total + Number(transaction.amount), 0);
      const total = Number(debt.amount);
      const remaining = Math.max(0, total - settled);
      return <TableRow key={debt.id}><TableCell>{debt.users?.shopName || debt.users?.name || "-"}</TableCell><TableCell>{debt.debtType === "money" ? "ค้างเงิน" : "ค้างถัง"}</TableCell><TableCell>{debt.products ? `${debt.products.name}${debt.products.size ? ` ${debt.products.size} กก.` : ""}` : "-"}</TableCell><TableCell>{formatAmount(settled, debt.debtType)}</TableCell><TableCell>{formatAmount(total, debt.debtType)}</TableCell><TableCell>{formatAmount(remaining, debt.debtType)}</TableCell><TableCell><Chip size="small" color={debt.status === "paid" ? "success" : debt.status === "partial" ? "warning" : "default"} label={debt.status === "paid" ? "ครบแล้ว" : debt.status === "partial" ? "ชำระบางส่วน" : "ค้าง"} /></TableCell><TableCell>{debt.orderId ? <Button component={Link} href={`/admin/orders/${debt.orderId}`} size="small">ดูออเดอร์</Button> : "-"}</TableCell><TableCell><Button size="small" variant="outlined" disabled={remaining === 0} onClick={() => { setSettlingDebt(debt); setSettlementAmount(""); }}>{debt.debtType === "money" ? "รับชำระ" : "รับคืนถัง"}</Button></TableCell></TableRow>;
    })}{visibleDebts.length === 0 && <TableRow><TableCell colSpan={9} align="center">{debts.length === 0 ? "ยังไม่มีรายการหนี้" : "ไม่มีรายการในหมวดนี้"}</TableCell></TableRow>}</TableBody></Table></TableContainer>}

    <Dialog open={isManualOpen} onClose={() => !isSaving && setIsManualOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>บันทึกหนี้ค้าง (ลูกค้าโทรสั่ง)</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {manualError && <Alert severity="error">{manualError}</Alert>}
          <TextField autoFocus required fullWidth label="ชื่อ" value={manualForm.name} onChange={(event) => updateManualForm("name", event.target.value)} />
          <TextField fullWidth multiline minRows={2} label="ที่อยู่" value={manualForm.address} onChange={(event) => updateManualForm("address", event.target.value)} />
          <TextField required fullWidth type="tel" label="เบอร์ติดต่อ" placeholder="0812345678" value={manualForm.phone} onChange={(event) => updateManualForm("phone", event.target.value)} />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>หนี้ค้าง</Typography>
            <ToggleButtonGroup exclusive fullWidth color="primary" value={manualForm.debtType} onChange={(_, value: DebtTypeChoice | null) => value && updateManualForm("debtType", value)}>
              <ToggleButton value="cart">ค้างถัง</ToggleButton>
              <ToggleButton value="money">ค้างเงิน</ToggleButton>
              <ToggleButton value="both">ทั้งถังทั้งเงิน</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          {needsMoney && <TextField required fullWidth type="number" label="จำนวนเงินที่ค้าง (บาท)" slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} value={manualForm.moneyAmount} onChange={(event) => updateManualForm("moneyAmount", event.target.value)} />}
          {needsCart && <Stack spacing={2} direction={{ xs: "column", sm: "row" }}>
            <FormControl fullWidth required><InputLabel id="manual-tank-label">ถังที่ค้าง</InputLabel><Select labelId="manual-tank-label" label="ถังที่ค้าง" value={manualForm.productId} onChange={(event) => updateManualForm("productId", event.target.value)}>{tankProducts.map((product) => <MenuItem key={product.id} value={String(product.id)}>{product.name}{product.size ? ` ${Number(product.size)} กก.` : ""}</MenuItem>)}</Select></FormControl>
            <TextField required fullWidth type="number" label="จำนวนถัง" slotProps={{ htmlInput: { min: 1, step: 1 } }} value={manualForm.cartQuantity} onChange={(event) => updateManualForm("cartQuantity", event.target.value)} />
          </Stack>}
          <TextField fullWidth label="หมายเหตุ" value={manualForm.note} onChange={(event) => updateManualForm("note", event.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" color="error" onClick={() => setIsManualOpen(false)} disabled={isSaving}>ยกเลิก</Button>
        <Button variant="contained" color="success" onClick={() => void createManualDebt()} disabled={isSaving || !canSaveManual}>บันทึกหนี้</Button>
      </DialogActions>
    </Dialog>

    <Dialog open={!!settlingDebt} onClose={() => !isSaving && setSettlingDebt(null)} fullWidth maxWidth="xs"><DialogTitle>{settlingDebt?.debtType === "money" ? "บันทึกรับชำระเงิน" : "บันทึกรับคืนถัง"}</DialogTitle><DialogContent><TextField autoFocus fullWidth sx={{ mt: 1 }} type="number" slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} label={settlingDebt?.debtType === "money" ? "จำนวนเงิน" : "จำนวนถัง"} value={settlementAmount} onChange={(event) => setSettlementAmount(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setSettlingDebt(null)} disabled={isSaving}>ยกเลิก</Button><Button variant="contained" onClick={() => void settleDebt()} disabled={isSaving || !settlementAmount}>บันทึก</Button></DialogActions></Dialog>
  </Box>;
}
