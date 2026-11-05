"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import type { ATTENDANCERECORD } from "@/app/models/attendance";
import { ADMINROLE } from "@/app/models/admin";
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
  const [scope, setScope] = useState<Scope>("mine");
  const [records, setRecords] = useState<ATTENDANCERECORD[]>([]);
  const [myRecords, setMyRecords] = useState<ATTENDANCERECORD[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
    try {
      // ปุ่มเข้า-ออกงานดูจากประวัติของตัวเองเสมอ ไม่ว่าแอดมินจะเปิดดูรายการของทุกคนอยู่หรือไม่
      const mine = (await request<ATTENDANCERECORD[]>("/api/attend")) ?? [];
      setMyRecords(mine);
      setRecords(scope === "all" ? ((await request<ATTENDANCERECORD[]>("/api/attend?scope=all")) ?? []) : mine);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดเวลาทำงานได้");
    } finally {
      setIsLoading(false);
    }
  }, [request, scope]);

  useEffect(() => {
    if (isAllowed) void load();
  }, [isAllowed, load]);

  const openRecord = useMemo(() => myRecords.find((record) => record.checkOutTime === null) ?? null, [myRecords]);

  async function clock(action: "clockin" | "clockout") {
    setIsSaving(true);
    setError(null);
    try {
      await request(`/api/attend/${action}`, { method: "POST", body: JSON.stringify({ note }) });
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
            <Typography sx={{ fontWeight: 700 }}>{admin?.name || admin?.email}</Typography>
            {openRecord
              ? <Chip color="success" label={`เข้างานแล้วเมื่อ ${formatDateTime(openRecord.checkInTime)}`} />
              : <Chip label="ยังไม่ได้เข้างาน" />}
          </Stack>
          <TextField label="หมายเหตุ (ไม่บังคับ)" value={note} onChange={(event) => setNote(event.target.value)} fullWidth />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="success" disabled={isSaving || openRecord !== null} onClick={() => void clock("clockin")}>
              เข้างาน
            </Button>
            <Button variant="contained" color="warning" disabled={isSaving || openRecord === null} onClick={() => void clock("clockout")}>
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
          <ToggleButton value="mine">ของฉัน</ToggleButton>
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
