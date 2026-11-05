"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import { ANNOUNCEMENTTYPE, type ANNOUNCEMENT } from "@/app/models/announcement";
import { ADMINROLE } from "@/app/models/admin";
import { useRequireAdmin } from "../useRequireAdmin";

type FormState = {
  id: string | null;
  title: string;
  content: string;
  imageUrl: string;
  type: ANNOUNCEMENTTYPE;
  isPublished: boolean;
  expiresAt: string;
};

const EMPTY_FORM: FormState = {
  id: null, title: "", content: "", imageUrl: "", type: ANNOUNCEMENTTYPE.PROMOTION, isPublished: true, expiresAt: "",
};

const TYPE_LABELS: Record<string, string> = { promotion: "โปรโมชั่น", announcement: "ประกาศทั่วไป" };

// datetime-local ต้องการเวลาท้องถิ่นแบบ YYYY-MM-DDTHH:mm
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminAnnouncementsPage() {
  const { isAllowed } = useRequireAdmin({
    roles: [ADMINROLE.ADMIN, ADMINROLE.SUPER_ADMIN],
    redirectTo: "/admin/attendance",
  });
  const [items, setItems] = useState<ANNOUNCEMENT[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
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
    const result = (await response.json()) as APIRESULT<T>;
    if (!response.ok || result.status === "error") throw new Error(result.message);
    return result.results;
  }, []);

  const load = useCallback(async () => {
    try {
      setItems(await request<ANNOUNCEMENT[]>("/api/announcements?scope=all"));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดประกาศได้");
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (isAllowed) void load();
  }, [isAllowed, load]);

  async function save() {
    if (!form) return;
    if (!form.title.trim()) {
      setError("กรุณากรอกหัวข้อประกาศ");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({
        title: form.title,
        content: form.content,
        imageUrl: form.imageUrl,
        type: form.type,
        isPublished: form.isPublished,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      });
      if (form.id) await request(`/api/announcements?id=${encodeURIComponent(form.id)}`, { method: "PATCH", body });
      else await request("/api/announcements", { method: "POST", body });
      setForm(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ไม่สามารถบันทึกประกาศได้");
    } finally {
      setIsSaving(false);
    }
  }

  async function togglePublish(item: ANNOUNCEMENT) {
    setError(null);
    try {
      await request(`/api/announcements?id=${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: !item.isPublished }),
      });
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "ไม่สามารถเปลี่ยนสถานะประกาศได้");
    }
  }

  async function remove(item: ANNOUNCEMENT) {
    if (!window.confirm(`ต้องการลบประกาศ "${item.title}" ใช่หรือไม่?`)) return;
    setError(null);
    try {
      await request(`/api/announcements?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "ไม่สามารถลบประกาศได้");
    }
  }

  if (!isAllowed || isLoading) {
    return <Box sx={{ p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box component="main" sx={{ p: 4, flexGrow: 1 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5">ประกาศและโปรโมชั่น</Typography>
        <Button variant="contained" onClick={() => setForm({ ...EMPTY_FORM })}>โพสต์ประกาศใหม่</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>หัวข้อ</TableCell>
              <TableCell>ประเภท</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell>หมดอายุ</TableCell>
              <TableCell>จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => {
              const expired = item.expiresAt !== null && new Date(item.expiresAt) < new Date();
              return (
                <TableRow key={item.id}>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{TYPE_LABELS[item.type] ?? item.type}</TableCell>
                  <TableCell>
                    {!item.isPublished
                      ? <Chip size="small" label="ฉบับร่าง" />
                      : expired
                        ? <Chip size="small" color="warning" label="หมดอายุ" />
                        : <Chip size="small" color="success" label="เผยแพร่แล้ว" />}
                  </TableCell>
                  <TableCell>{item.expiresAt ? new Date(item.expiresAt).toLocaleString("th-TH") : "-"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => setForm({
                        id: item.id, title: item.title, content: item.content ?? "", imageUrl: item.imageUrl ?? "",
                        type: item.type, isPublished: item.isPublished, expiresAt: toLocalInput(item.expiresAt),
                      })}>แก้ไข</Button>
                      <Button size="small" onClick={() => void togglePublish(item)}>
                        {item.isPublished ? "ซ่อน" : "เผยแพร่"}
                      </Button>
                      <Button size="small" color="error" onClick={() => void remove(item)}>ลบ</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center">ยังไม่มีประกาศ</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={form !== null} onClose={() => !isSaving && setForm(null)} fullWidth maxWidth="sm">
        <DialogTitle>{form?.id ? "แก้ไขประกาศ" : "โพสต์ประกาศใหม่"}</DialogTitle>
        {form && (
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="หัวข้อ" value={form.title} required fullWidth
                onChange={(event) => setForm({ ...form, title: event.target.value })} />
              <TextField select label="ประเภท" value={form.type} fullWidth
                onChange={(event) => setForm({ ...form, type: event.target.value as ANNOUNCEMENTTYPE })}>
                <MenuItem value={ANNOUNCEMENTTYPE.PROMOTION}>โปรโมชั่น</MenuItem>
                <MenuItem value={ANNOUNCEMENTTYPE.ANNOUNCEMENT}>ประกาศทั่วไป (เช่น แจ้งราคา)</MenuItem>
              </TextField>
              <TextField label="รายละเอียด" value={form.content} multiline minRows={4} fullWidth
                onChange={(event) => setForm({ ...form, content: event.target.value })} />
              <TextField label="ลิงก์รูปภาพ (ถ้ามี)" value={form.imageUrl} fullWidth
                onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
              <TextField label="หมดอายุเมื่อ (ไม่บังคับ)" type="datetime-local" value={form.expiresAt} fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
              <FormControlLabel
                control={<Switch checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />}
                label={form.isPublished ? "เผยแพร่ให้ลูกค้าเห็นทันที" : "บันทึกเป็นฉบับร่าง (ลูกค้ายังไม่เห็น)"} />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setForm(null)} disabled={isSaving}>ยกเลิก</Button>
          <Button variant="contained" onClick={() => void save()} disabled={isSaving}>
            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
