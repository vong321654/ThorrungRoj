"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { ApiResult } from "@/app/api/response";
import { AdminRole } from "@/app/models/admin";
import { useRequireAdmin } from "../useRequireAdmin";

type Customer = {
  id: string; name: string; phone: string | null; email: string | null; address: string | null;
  contactName: string | null; shopName: string | null; customerType: "individual" | "shop";
  isActive: boolean; createdAt: string;
};

export default function AdminUsersPage() {
  const { admin, isAllowed } = useRequireAdmin();
  const [users, setUsers] = useState<Customer[]>([]);
  const [editingUser, setEditingUser] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const isSuperAdmin = admin?.role === AdminRole.SuperAdmin;

  useEffect(() => {
    if (!isAllowed) return;
    async function loadUsers() {
      const { data } = await createClient().auth.getSession();
      const response = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const result = await response.json() as ApiResult<Customer[]>;
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
      const result = await response.json() as ApiResult<Customer>;
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
    if (!window.confirm(`ต้องการลบผู้ใช้ ${user.name} หรือไม่? บัญชีจะถูกปิดใช้งาน แต่ประวัติคำสั่งซื้อจะยังคงอยู่`)) return;

    setDeletingUserId(user.id);
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      const result = await response.json() as ApiResult<Customer>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setUsers((current) => current.map((item) => item.id === result.results.id ? result.results : item));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "ไม่สามารถลบผู้ใช้ได้");
    } finally {
      setDeletingUserId(null);
    }
  }

  return <Box sx={{ p: 4 }}>
    <Button component={Link} href="/admin" sx={{ mb: 2 }}>← กลับหน้าจัดการระบบ</Button>
    <Typography variant="h5" sx={{ mb: 2 }}>ผู้ใช้</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {isLoading ? <CircularProgress /> : !error && users.length === 0 ? <Paper sx={{ p: 3 }}>ยังไม่มีผู้ใช้</Paper> : <TableContainer component={Paper}><Table><TableHead><TableRow><TableCell>ชื่อ</TableCell><TableCell>ร้านค้า</TableCell><TableCell>โทรศัพท์</TableCell><TableCell>อีเมล</TableCell><TableCell>ประเภท</TableCell><TableCell>สถานะ</TableCell><TableCell>สมัครเมื่อ</TableCell>{isSuperAdmin && <TableCell>จัดการ</TableCell>}</TableRow></TableHead><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell>{user.name}</TableCell><TableCell>{user.shopName || "-"}</TableCell><TableCell>{user.phone || "-"}</TableCell><TableCell>{user.email || "-"}</TableCell><TableCell>{user.customerType === "shop" ? "ร้านค้า" : "บุคคลทั่วไป"}</TableCell><TableCell>{user.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</TableCell><TableCell>{new Date(user.createdAt).toLocaleDateString("th-TH")}</TableCell>{isSuperAdmin && <TableCell><Button size="small" onClick={() => setEditingUser(user)}>แก้ไข</Button><Button size="small" color="error" disabled={!user.isActive || deletingUserId === user.id} onClick={() => void deleteUser(user)}>ลบผู้ใช้</Button></TableCell>}</TableRow>)}</TableBody></Table></TableContainer>}

    <Dialog open={!!editingUser} onClose={() => !isSaving && setEditingUser(null)} fullWidth maxWidth="sm">
      <DialogTitle>แก้ไขข้อมูลผู้ใช้</DialogTitle>
      {editingUser && <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
        <TextField label="ชื่อ" value={editingUser.name} onChange={(event) => setEditingUser({ ...editingUser, name: event.target.value })} required />
        <TextField label="ผู้ติดต่อ" value={editingUser.contactName ?? ""} onChange={(event) => setEditingUser({ ...editingUser, contactName: event.target.value || null })} />
        <TextField label="ชื่อร้าน" value={editingUser.shopName ?? ""} onChange={(event) => setEditingUser({ ...editingUser, shopName: event.target.value || null })} />
        <TextField label="โทรศัพท์" value={editingUser.phone ?? ""} onChange={(event) => setEditingUser({ ...editingUser, phone: event.target.value || null })} />
        <TextField label="อีเมล" type="email" value={editingUser.email ?? ""} onChange={(event) => setEditingUser({ ...editingUser, email: event.target.value || null })} />
        <TextField label="ที่อยู่" value={editingUser.address ?? ""} multiline minRows={2} onChange={(event) => setEditingUser({ ...editingUser, address: event.target.value || null })} />
        <Select value={editingUser.customerType} onChange={(event) => setEditingUser({ ...editingUser, customerType: event.target.value as Customer["customerType"] })}><MenuItem value="individual">บุคคลทั่วไป</MenuItem><MenuItem value="shop">ร้านค้า</MenuItem></Select>
        <Select value={editingUser.isActive ? "active" : "inactive"} onChange={(event) => setEditingUser({ ...editingUser, isActive: event.target.value === "active" })}><MenuItem value="active">ใช้งาน</MenuItem><MenuItem value="inactive">ปิดใช้งาน</MenuItem></Select>
      </DialogContent>}
      <DialogActions><Button onClick={() => setEditingUser(null)} disabled={isSaving}>ยกเลิก</Button><Button variant="contained" onClick={() => void saveUser()} disabled={isSaving}>บันทึก</Button></DialogActions>
    </Dialog>
  </Box>;
}
