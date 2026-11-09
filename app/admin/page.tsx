"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  deleteAdmin,
  deleteAdminsPermanently,
  getAdminsList,
  getDashboardStats,
  type DASHBOARDSTATS,
} from "./allFunc";
import { useAdminSession } from "./AdminSessionContext";
import { useRequireAdmin } from "./useRequireAdmin";
import { ADMINROLE, type ADMINDATA } from "@/app/models/admin";

const EMPTY_STATS: DASHBOARDSTATS = {
  monthlySales: 0,
  monthlyUnitsSold: 0,
  outstandingMoney: 0,
  outstandingCarts: 0,
};

function formatNumber(value: number) {
  return value.toLocaleString("th-TH");
}

export default function AdminPage() {
  const router = useRouter();
  const { admin: adminData, isLoading: isSessionLoading } = useRequireAdmin();
  const { signOut } = useAdminSession();
  const [employeesData, setEmployeesData] = useState<ADMINDATA[] | null>(null);
  const [dashboardStats, setDashboardStats] =
    useState<DASHBOARDSTATS>(EMPTY_STATS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [deleteFailures, setDeleteFailures] = useState<string[]>([]);

  async function fetchEmployeesData() {
    try {
      setEmployeesData((await getAdminsList()) || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถโหลดข้อมูลผู้ดูแลระบบได้",
      );
    } finally {
      setIsLoadingAdmins(false);
    }
  }

  async function fetchDashboardStats() {
    try {
      setDashboardStats(await getDashboardStats());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถโหลดข้อมูล Dashboard ได้",
      );
    } finally {
      setIsLoadingStats(false);
    }
  }

  useEffect(() => {
    if (isSessionLoading || !adminData) return;
    // แดชบอร์ดสถิติเป็นของผู้ดูแลเท่านั้น พนักงานไปหน้าเวลาทำงานแทน
    if (adminData.role === ADMINROLE.EMPLOYEE) {
      router.replace("/admin/attendance");
      return;
    }
    void fetchDashboardStats();
    if (adminData.role === ADMINROLE.SUPER_ADMIN) void fetchEmployeesData();
    else setIsLoadingAdmins(false);
  }, [isSessionLoading, adminData, router]);

  async function handleSignOut() {
    await signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("ต้องการปิดใช้งานบัญชีผู้ดูแลระบบนี้ใช่หรือไม่?"))
      return;
    try {
      await deleteAdmin(id);
      await fetchEmployeesData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ไม่สามารถปิดใช้งานบัญชีได้",
      );
    }
  }

  const isSuperAdmin = adminData?.role === ADMINROLE.SUPER_ADMIN;
  // บัญชีตัวเองเลือกไม่ได้ กันลบตัวเองจนไม่เหลือ super admin
  const selectableEmployees = (employeesData ?? []).filter((employee) => employee.id !== adminData?.id);
  const selectedEmployees = selectableEmployees.filter((employee) => selectedIds.has(employee.id));
  const allSelected = selectableEmployees.length > 0 && selectedEmployees.length === selectableEmployees.length;

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableEmployees.map((employee) => employee.id)));
  }

  async function handleBulkDelete() {
    setIsDeleting(true);
    setErrorMessage(null);
    setDeleteNotice(null);
    setDeleteFailures([]);
    try {
      const result = await deleteAdminsPermanently(selectedEmployees.map((employee) => employee.id));
      if (result.deleted.length > 0) setDeleteNotice(`ลบผู้ดูแลแล้ว ${result.deleted.length} คน`);
      setDeleteFailures(result.failed.map((failure) => `${failure.email ?? failure.id}: ${failure.reason}`));
      // คนที่ลบไม่ได้ยังเลือกค้างไว้ จะได้เห็นว่าเหลือใคร
      setSelectedIds(new Set(result.failed.map((failure) => failure.id)));
      await fetchEmployeesData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถลบผู้ดูแลได้");
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  }

  const statCards = [
    ["ยอดขายเดือนนี้", `${formatNumber(dashboardStats.monthlySales)} บาท`],
    [
      "จำนวนที่ขายได้เดือนนี้",
      `${formatNumber(dashboardStats.monthlyUnitsSold)} รายการ`,
    ],
    ["ยอดค้างเงิน", `${formatNumber(dashboardStats.outstandingMoney)} บาท`],
    ["จำนวนถังค้าง", `${formatNumber(dashboardStats.outstandingCarts)} ถัง`],
  ];

  return (
    <Box
      component="main"
      sx={{ maxWidth: 1180, mx: "auto", p: { xs: 2, md: 4 } }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          mb: 3,
          justifyContent: "space-between",
          alignItems: { sm: "center" },
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Dashboard
          </Typography>
          <Typography color="text.secondary">
            ภาพรวมการขายและยอดคงค้างของร้านในเดือนนี้
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {adminData && (
            <Button component={Link} href={`/admin/editAdmin/${adminData.id}`}>
              แก้ไขบัญชี
            </Button>
          )}
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => handleSignOut()}
          >
            ออกจากระบบ
          </Button>
        </Stack>
      </Stack>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}
      {isLoadingStats ? (
        <CircularProgress />
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))",
            gap: 2,
            mb: 3,
          }}
        >
          {statCards.map(([label, value]) => (
            <Paper key={label} sx={{ p: 2.5 }}>
              <Typography color="text.secondary">{label}</Typography>
              <Typography
                variant="h5"
                color="success.dark"
                sx={{ fontWeight: 700 }}
              >
                {value}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}
      {adminData?.role === ADMINROLE.SUPER_ADMIN && (
        <Box component="section" id="admins">
          <Stack
            direction="row"
            sx={{
              mb: 2,
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              ผู้ดูแลระบบ
            </Typography>
            <Stack direction="row" spacing={1}>
              {isSuperAdmin && (
                <Button
                  variant="outlined"
                  color="error"
                  disabled={selectedEmployees.length === 0 || isDeleting}
                  onClick={() => setConfirmOpen(true)}
                >
                  ลบที่เลือก{selectedEmployees.length > 0 ? ` (${selectedEmployees.length})` : ""}
                </Button>
              )}
              <Button component={Link} href="/admin/addAdmin" variant="contained">
                เพิ่มพนักงานใหม่
              </Button>
            </Stack>
          </Stack>
          {deleteNotice && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDeleteNotice(null)}>
              {deleteNotice}
            </Alert>
          )}
          {deleteFailures.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setDeleteFailures([])}>
              ลบไม่ได้ {deleteFailures.length} คน:
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {deleteFailures.map((line) => <li key={line}>{line}</li>)}
              </Box>
            </Alert>
          )}
          {isLoadingAdmins ? (
            <CircularProgress />
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    {isSuperAdmin && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={allSelected}
                          indeterminate={selectedEmployees.length > 0 && !allSelected}
                          disabled={selectableEmployees.length === 0 || isDeleting}
                          onChange={toggleAll}
                          slotProps={{ input: { "aria-label": "เลือกผู้ดูแลทั้งหมด" } }}
                        />
                      </TableCell>
                    )}
                    <TableCell>Email</TableCell>
                    <TableCell>ชื่อ</TableCell>
                    <TableCell>สถานะ</TableCell>
                    <TableCell>บทบาท</TableCell>
                    <TableCell>อัปเดตล่าสุด</TableCell>
                    <TableCell>จัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employeesData?.map((employee) => (
                    <TableRow key={employee.id} selected={selectedIds.has(employee.id)}>
                      {isSuperAdmin && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.has(employee.id)}
                            disabled={employee.id === adminData.id || isDeleting}
                            onChange={() => toggleSelected(employee.id)}
                            slotProps={{ input: { "aria-label": `เลือก ${employee.email}` } }}
                          />
                        </TableCell>
                      )}
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>
                        {employee.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                      </TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell>{employee.updatedAt}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button
                            component={Link}
                            href={`/admin/editAdmin/${employee.id}`}
                            size="small"
                          >
                            แก้ไข
                          </Button>
                          {adminData.id !== employee.id && (
                            <Button
                              size="small"
                              color="warning"
                              onClick={() => void handleDelete(employee.id)}
                            >
                              ปิดใช้งาน
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      <Dialog open={confirmOpen} onClose={() => !isDeleting && setConfirmOpen(false)} aria-labelledby="bulkDeleteTitle">
        <DialogTitle id="bulkDeleteTitle">ลบผู้ดูแล {selectedEmployees.length} คนถาวร?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Box component="ul" sx={{ mt: 0, pl: 2.5 }}>
              {selectedEmployees.map((employee) => (
                <li key={employee.id}>{employee.name || "-"} ({employee.email})</li>
              ))}
            </Box>
            ลบแล้วกู้คืนไม่ได้ บัญชีล็อกอินและประวัติเวลาทำงานของคนเหล่านี้จะถูกลบด้วย
            ถ้าใครเคยสร้างหรือแก้สินค้า แบรนด์ หรือบันทึกรับชำระหนี้ไว้ ระบบจะไม่ลบคนนั้น ให้ใช้ปิดใช้งานแทน
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={isDeleting}>ยกเลิก</Button>
          <Button color="error" variant="contained" onClick={() => void handleBulkDelete()} disabled={isDeleting}>
            {isDeleting ? "กำลังลบ..." : "ลบถาวร"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
