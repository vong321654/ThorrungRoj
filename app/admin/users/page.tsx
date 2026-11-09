"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import { ADMINROLE } from "@/app/models/admin";
import { useRequireAdmin, MANAGER_ONLY } from "../useRequireAdmin";

type Customer = {
  id: string; name: string; phone: string | null; email: string | null; address: string | null; avatarUrl: string | null;
  contactName: string | null; shopName: string | null; customerType: "individual" | "shop";
  shopRequestStatus: "pending" | "approved" | "rejected" | null; customerTypeChosenAt: string | null;
  isActive: boolean; createdAt: string;
};

function customerTypeLabel(user: Customer) {
  if (user.customerType === "shop") return "ร้านค้า";
  return user.shopRequestStatus === "pending" ? "บุคคลทั่วไป (รอยืนยันร้านค้า)" : "บุคคลทั่วไป";
}

export default function AdminUsersPage() {
  const { admin, isAllowed } = useRequireAdmin(MANAGER_ONLY);
  const [users, setUsers] = useState<Customer[]>([]);
  const [editingUser, setEditingUser] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [erasingUserId, setErasingUserId] = useState<string | null>(null);
  const [reviewingUserId, setReviewingUserId] = useState<string | null>(null);
  const isSuperAdmin = admin?.role === ADMINROLE.SUPER_ADMIN;
  const shopRequests = users
    .filter((user) => user.shopRequestStatus === "pending")
    .sort((a, b) => (a.customerTypeChosenAt ?? a.createdAt).localeCompare(b.customerTypeChosenAt ?? b.createdAt));

  useEffect(() => {
    if (!isAllowed) return;
    async function loadUsers() {
      const { data } = await createClient().auth.getSession();
      const response = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const result = await response.json() as APIRESULT<Customer[]>;
      if (!response.ok || result.status === "error") setError(result.message);
      else setUsers(result.results);
      setIsLoading(false);
    }
    void loadUsers();
  }, [isAllowed]);

  async function saveUser() {
    if (!editingUser) return;
    setIsSaving(true);
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify(editingUser),
      });
      const result = await response.json() as APIRESULT<Customer>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setUsers((current) => current.map((user) => user.id === result.results.id ? result.results : user));
      setEditingUser(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ไม่สามารถบันทึกข้อมูลผู้ใช้ได้");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteUser(user: Customer) {
    if (!window.confirm(`ต้องการปิดใช้งานบัญชี ${user.name} หรือไม่? ข้อมูลจะยังอยู่ในระบบ หากลูกค้าขอให้ลบข้อมูล ให้ใช้ปุ่ม "ลบข้อมูลถาวร"`)) return;

    setDeletingUserId(user.id);
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      const result = await response.json() as APIRESULT<Customer>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setUsers((current) => current.map((item) => item.id === result.results.id ? result.results : item));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "ไม่สามารถลบผู้ใช้ได้");
    } finally {
      setDeletingUserId(null);
    }
  }

  async function reviewShopRequest(user: Customer, action: "approve" | "reject") {
    setReviewingUserId(user.id);
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      const response = await fetch("/api/admin/users/shop-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ id: user.id, action }),
      });
      const result = await response.json() as APIRESULT<Customer>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setUsers((current) => current.map((item) => item.id === result.results.id ? result.results : item));
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "ไม่สามารถบันทึกผลการตรวจสอบได้");
    } finally {
      setReviewingUserId(null);
    }
  }

  async function eraseUser(user: Customer) {
    if (!window.confirm(`ลบข้อมูลส่วนบุคคลของ ${user.name} ถาวรตามคำขอของลูกค้าหรือไม่?\n\nชื่อ เบอร์โทร ที่อยู่ รูปโปรไฟล์ ประวัติแชท และบัญชีเข้าสู่ระบบจะถูกลบและกู้คืนไม่ได้ ส่วนคำสั่งซื้อและสลิปจะเก็บไว้เป็นหลักฐานทางบัญชีจนพ้นกำหนด`)) return;

    setErasingUserId(user.id);
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      const response = await fetch("/api/admin/users/erase", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ id: user.id }),
      });
      const result = await response.json() as APIRESULT<null>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (eraseError) {
      setError(eraseError instanceof Error ? eraseError.message : "ไม่สามารถลบข้อมูลลูกค้าได้");
    } finally {
      setErasingUserId(null);
    }
  }

  return <Box sx={{ p: 4 }}>
    <Button variant="contained" component={Link} href="/admin" sx={{ mb: 2 }}>← กลับหน้าจัดการระบบ</Button>
    <Typography variant="h5" sx={{ mb: 2 }}>ผู้ใช้</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    {!isLoading && shopRequests.length > 0 && <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>คำขอเป็นร้านค้า ({shopRequests.length})</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        ยืนยัน = บัญชีได้ราคาร้านค้า, ยกเลิก = เป็นบ้านทั่วไป ระหว่างรอตรวจสอบลูกค้าจะเห็นราคาบ้านทั่วไป
      </Typography>
      <TableContainer component={Paper}><Table size="small"><TableHead><TableRow>
        <TableCell>ชื่อ</TableCell><TableCell>ชื่อร้าน</TableCell><TableCell>โทรศัพท์</TableCell><TableCell>ที่อยู่</TableCell><TableCell>ขอเมื่อ</TableCell><TableCell>จัดการ</TableCell>
      </TableRow></TableHead><TableBody>{shopRequests.map((user) => <TableRow key={user.id}>
        <TableCell>{user.name}</TableCell>
        <TableCell>{user.shopName || "-"}</TableCell>
        <TableCell>{user.phone || "-"}</TableCell>
        <TableCell sx={{ maxWidth: 260, overflowWrap: "anywhere" }}>{user.address || "-"}</TableCell>
        <TableCell>{new Date(user.customerTypeChosenAt ?? user.createdAt).toLocaleString("th-TH")}</TableCell>
        <TableCell>{isSuperAdmin
          ? <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button size="small" variant="contained" color="success" disabled={reviewingUserId === user.id} onClick={() => void reviewShopRequest(user, "approve")}>ยืนยัน</Button>
            <Button size="small" variant="contained" color="error" disabled={reviewingUserId === user.id} onClick={() => void reviewShopRequest(user, "reject")}>ยกเลิก</Button>
          </Box>
          : <Typography variant="body2" color="text.secondary">รอ super admin ตรวจสอบ</Typography>}</TableCell>
      </TableRow>)}</TableBody></Table></TableContainer>
    </Box>}

    {isLoading ? <CircularProgress /> : !error && users.length === 0 ? <Paper sx={{ p: 3 }}>ยังไม่มีผู้ใช้</Paper> : <TableContainer component={Paper}><Table><TableHead><TableRow><TableCell>ชื่อ</TableCell><TableCell>ร้านค้า</TableCell><TableCell>โทรศัพท์</TableCell><TableCell>อีเมล</TableCell><TableCell>ประเภท</TableCell><TableCell>สถานะ</TableCell><TableCell>สมัครเมื่อ</TableCell>{isSuperAdmin && <TableCell>จัดการ</TableCell>}</TableRow></TableHead><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell>{user.name}</TableCell><TableCell>{user.shopName || "-"}</TableCell><TableCell>{user.phone || "-"}</TableCell><TableCell>{user.email || "-"}</TableCell><TableCell>{customerTypeLabel(user)}</TableCell><TableCell>{user.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</TableCell><TableCell>{new Date(user.createdAt).toLocaleDateString("th-TH")}</TableCell>{isSuperAdmin && <TableCell><Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}><Button size="small" variant="contained" onClick={() => setEditingUser(user)}>แก้ไข</Button><Button size="small" variant="contained" color="error" disabled={!user.isActive || deletingUserId === user.id} onClick={() => void deleteUser(user)}>ปิดใช้งาน</Button><Button size="small" variant="contained" color="error" disabled={erasingUserId === user.id} onClick={() => void eraseUser(user)}>ลบข้อมูลถาวร</Button></Box></TableCell>}</TableRow>)}</TableBody></Table></TableContainer>}

    <Dialog open={!!editingUser} onClose={() => !isSaving && setEditingUser(null)} fullWidth maxWidth="sm">
      <DialogTitle>แก้ไขข้อมูลผู้ใช้</DialogTitle>
      {editingUser && <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
        <TextField label="ชื่อ" value={editingUser.name} onChange={(event) => setEditingUser({ ...editingUser, name: event.target.value })} required />
        <TextField label="ผู้ติดต่อ" value={editingUser.contactName ?? ""} onChange={(event) => setEditingUser({ ...editingUser, contactName: event.target.value || null })} />
        <TextField label="ชื่อร้าน" value={editingUser.shopName ?? ""} onChange={(event) => setEditingUser({ ...editingUser, shopName: event.target.value || null })} />
        <TextField label="โทรศัพท์" value={editingUser.phone ?? ""} onChange={(event) => setEditingUser({ ...editingUser, phone: event.target.value || null })} />
        <TextField label="อีเมล" type="email" value={editingUser.email ?? ""} onChange={(event) => setEditingUser({ ...editingUser, email: event.target.value || null })} />
        <TextField label="ที่อยู่" value={editingUser.address ?? ""} multiline minRows={2} onChange={(event) => setEditingUser({ ...editingUser, address: event.target.value || null })} />
        {editingUser.avatarUrl && <Button variant="contained" color="error" onClick={() => setEditingUser({ ...editingUser, avatarUrl: null })}>ลบรูปโปรไฟล์ (ลูกค้าคัดค้านการใช้รูป)</Button>}
        <Select value={editingUser.customerType} onChange={(event) => setEditingUser({ ...editingUser, customerType: event.target.value as Customer["customerType"] })}><MenuItem value="individual">บุคคลทั่วไป</MenuItem><MenuItem value="shop">ร้านค้า</MenuItem></Select>
        <Select value={editingUser.isActive ? "active" : "inactive"} onChange={(event) => setEditingUser({ ...editingUser, isActive: event.target.value === "active" })}><MenuItem value="active">ใช้งาน</MenuItem><MenuItem value="inactive">ปิดใช้งาน</MenuItem></Select>
      </DialogContent>}
      <DialogActions><Button variant="contained" color="inherit" onClick={() => setEditingUser(null)} disabled={isSaving}>ยกเลิก</Button><Button variant="contained" onClick={() => void saveUser()} disabled={isSaving}>บันทึก</Button></DialogActions>
    </Dialog>
  </Box>;
}
