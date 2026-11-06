"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import type { ATTENDANCERECORD } from "@/app/models/attendance";
import { ADMINROLE, type ADMINDATA } from "@/app/models/admin";
import { getAdminsList } from "../allFunc";
import { useRequireAdmin } from "../useRequireAdmin";

type Scope = "mine" | "all";

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("th-TH") : "-";
}

function formatDuration(checkIn: string, checkOut: string | null) {
  if (!checkOut) return "-";
  const minutes = Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000));
  return `${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`;
}

export default function AttendancePage() {
  // พนักงานทุกบทบาทกดเข้า-ออกงานได้ ส่วนแอดมินดูของทุกคนได้เพิ่ม
  const { admin, isAllowed } = useRequireAdmin();
  const isManager = admin?.role === ADMINROLE.ADMIN || admin?.role === ADMINROLE.SUPER_ADMIN;
  const isSuperAdmin = admin?.role === ADMINROLE.SUPER_ADMIN;
  const [scope, setScope] = useState<Scope>("mine");
  const [records, setRecords] = useState<ATTENDANCERECORD[]>([]);
  const [targetRecords, setTargetRecords] = useState<ATTENDANCERECORD[]>([]);
  const [employees, setEmployees] = useState<ADMINDATA[]>([]);
  // superAdmin เลือกคนที่จะลงเวลาให้ได้ ถ้ายังไม่เลือกหรือเป็นบทบาทอื่น จะลงเวลาให้ตัวเอง
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const targetEmployeeId = selectedEmployeeId ?? admin?.id;
  const targetEmployee = employees.find((employee) => employee.id === targetEmployeeId);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTarget, setIsLoadingTarget] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const latestLoadRef = useRef(0);

  const request = useCallback(async function request<T>(path: string, options: RequestInit = {}) {
    const { data } = await createClient().auth.getSession();
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      },
    });
    const result = (await response.json()) as APIRESULT<T> | { message: string };
    if (!response.ok || ("status" in result && result.status === "error")) throw new Error(result.message);
    return (result as APIRESULT<T>).results;
  }, []);

  const load = useCallback(async () => {
    if (!targetEmployeeId) return;
    // สลับคนเร็วๆ แล้วผลของคนก่อนหน้าอาจมาทีหลัง จึงใช้เฉพาะผลของการโหลดครั้งล่าสุด
    const loadId = ++latestLoadRef.current;
    try {
      // ปุ่มเข้า-ออกงานดูจากประวัติของคนที่เลือกเสมอ ไม่ว่าแอดมินจะเปิดดูรายการของทุกคนอยู่หรือไม่
      const target = (await request<ATTENDANCERECORD[]>(`/api/attend?employeeId=${encodeURIComponent(targetEmployeeId)}`)) ?? [];
      const visible = scope === "all" ? ((await request<ATTENDANCERECORD[]>("/api/attend?scope=all")) ?? []) : target;
      if (loadId !== latestLoadRef.current) return;
      setTargetRecords(target);
      setRecords(visible);
      setError(null);
    } catch (loadError) {
      if (loadId !== latestLoadRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดเวลาทำงานได้");
    } finally {
      if (loadId === latestLoadRef.current) {
        setIsLoading(false);
        setIsLoadingTarget(false);
      }
    }
  }, [request, scope, targetEmployeeId]);

  useEffect(() => {
    if (isAllowed) void load();
  }, [isAllowed, load]);

  useEffect(() => {
    if (!isAllowed || !isSuperAdmin) return;
    getAdminsList()
      .then((list) => setEmployees((list ?? []).filter((employee) => employee.isActive)))
      .catch((listError: unknown) => {
        setError(listError instanceof Error ? listError.message : "ไม่สามารถโหลดรายชื่อพนักงานได้");
      });
  }, [isAllowed, isSuperAdmin]);

  const openRecord = useMemo(() => targetRecords.find((record) => record.checkOutTime === null) ?? null, [targetRecords]);

  function selectEmployee(employeeId: string) {
    if (employeeId === targetEmployeeId) return;
    // ล้างสถานะและหมายเหตุของคนเดิม กันกดปุ่มหรือบันทึกหมายเหตุผิดคนระหว่างรอโหลด
    setTargetRecords([]);
    setRecords((current) => (scope === "all" ? current : []));
    setNote("");
    setError(null);
    setIsLoadingTarget(true);
    setSelectedEmployeeId(employeeId);
  }

  async function clock(action: "clockin" | "clockout") {
    setIsSaving(true);
    setError(null);
    try {
      await request(`/api/attend/${action}`, { method: "POST", body: JSON.stringify({ note, employeeId: targetEmployeeId }) });
      setNote("");
      await load();
    } catch (clockError) {
      setError(clockError instanceof Error ? clockError.message : "ไม่สามารถบันทึกเวลาได้");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isAllowed || isLoading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>;

  return (
    <Box component="main" sx={{ p: 4, flexGrow: 1, maxWidth: 1100 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>เวลาเข้า-ออกงาน</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {isSuperAdmin && employees.length > 0 ? (
              <TextField
                select
                size="small"
                label="ลงเวลาให้"
                value={targetEmployeeId ?? ""}
                onChange={(event) => selectEmployee(event.target.value)}
                sx={{ minWidth: 240 }}
              >
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.name || employee.email}{employee.id === admin?.id ? " (ฉัน)" : ""}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <Typography sx={{ fontWeight: 700 }}>{admin?.name || admin?.email}</Typography>
            )}
            {isLoadingTarget
              ? <Chip label="กำลังโหลด..." />
              : openRecord
                ? <Chip color="success" label={`เข้างานแล้วเมื่อ ${formatDateTime(openRecord.checkInTime)}`} />
                : <Chip label="ยังไม่ได้เข้างาน" />}
          </Stack>
          <TextField label="หมายเหตุ (ไม่บังคับ)" value={note} onChange={(event) => setNote(event.target.value)} fullWidth />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="success" disabled={isSaving || isLoadingTarget || openRecord !== null} onClick={() => void clock("clockin")}>
              เข้างาน
            </Button>
            <Button variant="contained" color="warning" disabled={isSaving || isLoadingTarget || openRecord === null} onClick={() => void clock("clockout")}>
              ออกงาน
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {isManager && (
        <ToggleButtonGroup exclusive size="small" value={scope} sx={{ mb: 2 }}
          onChange={(_event, value: Scope | null) => {
            if (!value || value === scope) return;
            // ล้างแถวเดิมก่อน กันตารางโชว์แถวของมุมมองเก่าใต้หัวคอลัมน์ใหม่ระหว่างรอโหลด
            setRecords([]);
            setScope(value);
          }}>
          <ToggleButton value="mine">
            {targetEmployeeId === admin?.id ? "ของฉัน" : targetEmployee?.name || targetEmployee?.email}
          </ToggleButton>
          <ToggleButton value="all">พนักงานทุกคน</ToggleButton>
        </ToggleButtonGroup>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {scope === "all" && <TableCell>พนักงาน</TableCell>}
              <TableCell>วันที่</TableCell>
              <TableCell>เข้างาน</TableCell>
              <TableCell>ออกงาน</TableCell>
              <TableCell>รวมเวลา</TableCell>
              <TableCell>หมายเหตุ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                {scope === "all" && <TableCell>{record.employees?.name || record.employees?.email || "-"}</TableCell>}
                <TableCell>{record.workDate}</TableCell>
                <TableCell>{formatDateTime(record.checkInTime)}</TableCell>
                <TableCell>{record.checkOutTime ? formatDateTime(record.checkOutTime) : <Chip size="small" color="success" label="กำลังทำงาน" />}</TableCell>
                <TableCell>{formatDuration(record.checkInTime, record.checkOutTime)}</TableCell>
                <TableCell>{record.note ?? "-"}</TableCell>
              </TableRow>
            ))}
            {records.length === 0 && (
              <TableRow><TableCell colSpan={scope === "all" ? 6 : 5} align="center">ยังไม่มีประวัติเวลาทำงาน</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
