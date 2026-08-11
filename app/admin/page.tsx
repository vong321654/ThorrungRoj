"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, CircularProgress, Paper,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import { deleteAdmin, getAdminsList, getDashboardStats, type DashboardStats } from "./allFunc";
import { useAdminSession } from "./AdminSessionContext";
import { useRequireAdmin } from "./useRequireAdmin";
import { AdminRole, type AdminData } from "@/app/models/admin";

const EMPTY_STATS: DashboardStats = { monthlySales: 0, monthlyUnitsSold: 0, outstandingMoney: 0, outstandingCarts: 0 };

function formatNumber(value: number) {
  return value.toLocaleString("th-TH");
}

const managementItems = [
  ["/admin/product", "สินค้า", "เพิ่ม แก้ไข และจัดการรายการสินค้า"],
  ["/admin/orders", "คำสั่งซื้อ", "ตรวจสอบคำสั่งซื้อและสถานะการชำระเงิน"],
  ["/admin/debts", "หนี้ค้าง", "บันทึกค้างเงิน ค้างถัง และรับชำระหรือคืนถัง"],
  ["/admin/users", "ผู้ใช้", "ดูข้อมูลลูกค้าและสถานะบัญชี"],
] as const;

export default function AdminPage() {
  const router = useRouter();
  const { admin: adminData, isLoading: isSessionLoading } = useRequireAdmin();
  const { signOut } = useAdminSession();
  const [employeesData, setEmployeesData] = useState<AdminData[] | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(EMPTY_STATS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  async function fetchEmployeesData() {
    try {
      setEmployeesData((await getAdminsList()) || []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลผู้ดูแลระบบได้");
    } finally {
      setIsLoadingAdmins(false);
    }
  }

  async function fetchDashboardStats() {
    try {
      setDashboardStats(await getDashboardStats());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูล Dashboard ได้");
    } finally {
      setIsLoadingStats(false);
    }
  }

  useEffect(() => {
    if (isSessionLoading || !adminData) return;
    void fetchDashboardStats();
    if (adminData.role === AdminRole.SuperAdmin) void fetchEmployeesData();
    else setIsLoadingAdmins(false);
  }, [isSessionLoading, adminData]);

  async function handleSignOut() {
    await signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("ต้องการปิดใช้งานบัญชีผู้ดูแลระบบนี้ใช่หรือไม่?")) return;
    try {
      await deleteAdmin(id);
      await fetchEmployeesData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถปิดใช้งานบัญชีได้");
    }
  }

  const statCards = [
    ["ยอดขายเดือนนี้", `${formatNumber(dashboardStats.monthlySales)} บาท`],
    ["จำนวนที่ขายได้เดือนนี้", `${formatNumber(dashboardStats.monthlyUnitsSold)} รายการ`],
    ["ยอดค้างเงิน", `${formatNumber(dashboardStats.outstandingMoney)} บาท`],
    ["จำนวนถังค้าง", `${formatNumber(dashboardStats.outstandingCarts)} ถัง`],
  ];

  return <Box component="main" sx={{ maxWidth: 1180, mx: "auto", p: { xs: 2, md: 4 } }}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3, justifyContent: "space-between", alignItems: { sm: "center" } }}>
      <Box><Typography variant="h4" sx={{ fontWeight: 700 }}>Dashboard</Typography><Typography color="text.secondary">ภาพรวมการขายและยอดคงค้างของร้านในเดือนนี้</Typography></Box>
      <Stack direction="row" spacing={1}>
        {adminData && <Button component={Link} href={`/admin/editAdmin/${adminData.id}`}>แก้ไขบัญชี</Button>}
        <Button variant="outlined" color="inherit" onClick={() => void handleSignOut}>ออกจากระบบ</Button>
      </Stack>
    </Stack>

    {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}
    {isLoadingStats ? <CircularProgress /> : <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))", gap: 2, mb: 3 }}>{statCards.map(([label, value]) => <Paper key={label} sx={{ p: 2.5 }}><Typography color="text.secondary">{label}</Typography><Typography variant="h5" color="success.dark" sx={{ fontWeight: 700 }}>{value}</Typography></Paper>)}</Box>}

    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 2, mb: 4 }}>
      {managementItems.map(([href, title, description]) => <Card key={href} variant="outlined"><CardActionArea component={Link} href={href} sx={{ minHeight: 136 }}><CardContent><Typography variant="h6">{title}</Typography><Typography variant="body2" color="text.secondary">{description}</Typography></CardContent></CardActionArea></Card>)}
    </Box>

    {adminData?.role === AdminRole.SuperAdmin && <Box component="section" id="admins">
      <Stack direction="row" sx={{ mb: 2, justifyContent: "space-between", alignItems: "center" }}><Typography variant="h5" sx={{ fontWeight: 700 }}>ผู้ดูแลระบบ</Typography><Button component={Link} href="/admin/addAdmin" variant="contained">เพิ่มผู้ดูแลระบบ</Button></Stack>
      {isLoadingAdmins ? <CircularProgress /> : <TableContainer component={Paper}><Table><TableHead><TableRow><TableCell>Email</TableCell><TableCell>ชื่อ</TableCell><TableCell>สถานะ</TableCell><TableCell>บทบาท</TableCell><TableCell>อัปเดตล่าสุด</TableCell><TableCell>จัดการ</TableCell></TableRow></TableHead><TableBody>{employeesData?.map((employee) => <TableRow key={employee.id}><TableCell>{employee.email}</TableCell><TableCell>{employee.name}</TableCell><TableCell>{employee.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</TableCell><TableCell>{employee.role}</TableCell><TableCell>{employee.updatedAt}</TableCell><TableCell><Stack direction="row" spacing={1}><Button component={Link} href={`/admin/editAdmin/${employee.id}`} size="small">แก้ไข</Button>{adminData.id !== employee.id && <Button size="small" color="warning" onClick={() => void handleDelete(employee.id)}>ปิดใช้งาน</Button>}</Stack></TableCell></TableRow>)}</TableBody></Table></TableContainer>}
    </Box>}
  </Box>;
}
