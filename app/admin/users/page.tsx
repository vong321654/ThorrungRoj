"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { ApiResult } from "@/app/api/response";
import { useRequireAdmin } from "../useRequireAdmin";

type Customer = { id: string; name: string; phone: string | null; email: string | null; shopName: string | null; customerType: string; isActive: boolean; createdAt: string };

export default function AdminUsersPage() {
  const { isAllowed } = useRequireAdmin();
  const [users, setUsers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAllowed) return;
    async function loadUsers() {
      const { data } = await createClient().auth.getSession();
      const response = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const result = await response.json() as ApiResult<Customer[]>;
      if (!response.ok || result.status === "error") {
        setError(result.message);
      } else {
        setUsers(result.results);
      }
      setIsLoading(false);
    }
    void loadUsers();
  }, [isAllowed]);

  return <Box sx={{ p: 4 }}>
    <Button component={Link} href="/admin" sx={{ mb: 2 }}>← กลับหน้าจัดการระบบ</Button>
    <Typography variant="h5" sx={{ mb: 2 }}>ผู้ใช้</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {isLoading ? <CircularProgress /> : !error && users.length === 0 ? <Paper sx={{ p: 3 }}>ยังไม่มีผู้ใช้</Paper> : <TableContainer component={Paper}><Table><TableHead><TableRow><TableCell>ชื่อ</TableCell><TableCell>ร้านค้า</TableCell><TableCell>โทรศัพท์</TableCell><TableCell>อีเมล</TableCell><TableCell>ประเภท</TableCell><TableCell>สถานะ</TableCell><TableCell>สมัครเมื่อ</TableCell></TableRow></TableHead><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell>{user.name}</TableCell><TableCell>{user.shopName || "-"}</TableCell><TableCell>{user.phone || "-"}</TableCell><TableCell>{user.email || "-"}</TableCell><TableCell>{user.customerType === "shop" ? "ร้านค้า" : "บุคคลทั่วไป"}</TableCell><TableCell>{user.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</TableCell><TableCell>{new Date(user.createdAt).toLocaleDateString("th-TH")}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
  </Box>;
}
