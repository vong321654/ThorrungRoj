"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import { ANNOUNCEMENTTYPE, type ANNOUNCEMENT, type ANNOUNCEMENTSAVERESULT } from "@/app/models/announcement";
import { ADMINROLE } from "@/app/models/admin";
import { useRequireAdmin } from "../useRequireAdmin";
import { compressImage, UPLOAD_IMAGE_TYPES } from "@/app/util/compressImage";

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

// รับได้ทั้ง ISO จาก API และค่า datetime-local จากฟอร์ม ประกาศที่หมดอายุแล้วเซิร์ฟเวอร์จะไม่ส่งเข้า LINE
function isExpired(expiresAt: string | null) {
  return expiresAt !== null && new Date(expiresAt) <= new Date();
}

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
  const [lineWarning, setLineWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // เพิ่มทุกครั้งที่เปิด/ปิดฟอร์ม ผลอัปโหลดที่เสร็จหลังฟอร์มเดิมถูกปิดจะถูกทิ้ง
  // กันรูปของประกาศหนึ่งไปโผล่ในอีกประกาศ (แล้วถูกส่งเข้า LINE ลูกค้าทุกคน)
  const formSession = useRef(0);

  // อัปโหลดทันทีที่เลือกรูป (ย่อในเบราว์เซอร์ก่อน) แล้วเก็บลิงก์ไว้ส่งไปพร้อมประกาศตอนกดบันทึก
  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    // reset เพื่อให้เลือกไฟล์เดิมซ้ำได้ ถ้าอัปโหลดรอบก่อนพลาด
    event.target.value = "";
    if (!file) return;

    const session = formSession.current;
    setUploadError(null);
    setIsUploading(true);
    try {
      const body = new FormData();
      body.append("type", "announcement");
      body.append("file", await compressImage(file));
      const { data } = await createClient().auth.getSession();
      // ไม่ใส่ Content-Type เอง ให้ browser ใส่ multipart boundary ให้
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body,
      });
      // Vercel อาจตอบหน้า HTML (เช่น 413 ไฟล์ใหญ่ หรือ 504 timeout) ซึ่ง parse เป็น JSON ไม่ได้
      const result = (await response.json().catch(() => null)) as APIRESULT<{ imageUrl: string }> | null;
      if (!result) throw new Error(`เซิร์ฟเวอร์ตอบผิดพลาด (${response.status}) กรุณาลองใหม่`);
      if (!response.ok || result.status === "error") throw new Error(result.message);
      if (session !== formSession.current) return;
      setForm((current) => current && { ...current, imageUrl: result.results.imageUrl });
    } catch (imageError) {
      if (session !== formSession.current) return;
      setUploadError(imageError instanceof Error ? `อัปโหลดรูปไม่สำเร็จ: ${imageError.message}` : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      if (session === formSession.current) setIsUploading(false);
    }
  }

  function openForm(next: FormState) {
    formSession.current += 1;
    setUploadError(null);
    setIsUploading(false);
    setForm(next);
  }

  function closeForm() {
    formSession.current += 1;
    setIsUploading(false);
    setForm(null);
  }
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
      const saved = form.id
        ? await request<ANNOUNCEMENTSAVERESULT>(`/api/announcements?id=${encodeURIComponent(form.id)}`, { method: "PATCH", body })
        : await request<ANNOUNCEMENTSAVERESULT>("/api/announcements", { method: "POST", body });
      showLineResult(saved);
      closeForm();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ไม่สามารถบันทึกประกาศได้");
    } finally {
      setIsSaving(false);
    }
  }

  // ประกาศบันทึกสำเร็จแล้ว แต่ส่งเข้า LINE ไม่ได้ แจ้งแยกจาก error ปกติ
  function showLineResult(saved: ANNOUNCEMENTSAVERESULT) {
    setLineWarning(saved.lineNotifyError
      ? `บันทึกประกาศ "${saved.title}" แล้ว แต่ส่งเข้าแชท LINE ไม่สำเร็จ: ${saved.lineNotifyError} กดปุ่ม "ส่งเข้า LINE" เพื่อลองใหม่`
      : null);
  }

  // ส่งซ้ำด้วยการบันทึกสถานะเผยแพร่เดิม เซิร์ฟเวอร์จะส่งเข้า LINE ให้ถ้ายังไม่เคยส่งสำเร็จ
  async function retryLine(item: ANNOUNCEMENT) {
    if (!window.confirm(`ส่งประกาศ "${item.title}" เข้าแชท LINE ของลูกค้าทุกคนใช่หรือไม่?`)) return;
    setError(null);
    setRetryingId(item.id);
    try {
      const saved = await request<ANNOUNCEMENTSAVERESULT>(`/api/announcements?id=${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: true }),
      });
      showLineResult(saved);
      await load();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "ไม่สามารถส่งประกาศเข้า LINE ได้");
    } finally {
      setRetryingId(null);
    }
  }

  async function togglePublish(item: ANNOUNCEMENT) {
    const willNotifyLine = !item.isPublished && !item.lineNotifiedAt && !isExpired(item.expiresAt);
    if (willNotifyLine && !window.confirm(`เผยแพร่ "${item.title}" และส่งเข้าแชท LINE ของลูกค้าทุกคนใช่หรือไม่?`)) return;
    setError(null);
    try {
      const saved = await request<ANNOUNCEMENTSAVERESULT>(`/api/announcements?id=${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: !item.isPublished }),
      });
      showLineResult(saved);
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
        <Button variant="contained" onClick={() => openForm({ ...EMPTY_FORM })}>โพสต์ประกาศใหม่</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {lineWarning && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setLineWarning(null)}>{lineWarning}</Alert>}

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
                    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                      {!item.isPublished
                        ? <Chip size="small" label="ฉบับร่าง" />
                        : expired
                          ? <Chip size="small" color="warning" label="หมดอายุ" />
                          : <Chip size="small" color="success" label="เผยแพร่แล้ว" />}
                      {item.lineNotifiedAt && <Chip size="small" variant="outlined" color="success" label="ส่ง LINE แล้ว" />}
                    </Stack>
                  </TableCell>
                  <TableCell>{item.expiresAt ? new Date(item.expiresAt).toLocaleString("th-TH") : "-"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => openForm({
                        id: item.id, title: item.title, content: item.content ?? "", imageUrl: item.imageUrl ?? "",
                        type: item.type, isPublished: item.isPublished, expiresAt: toLocalInput(item.expiresAt),
                      })}>แก้ไข</Button>
                      <Button size="small" onClick={() => void togglePublish(item)}>
                        {item.isPublished ? "ซ่อน" : "เผยแพร่"}
                      </Button>
                      {item.isPublished && !expired && !item.lineNotifiedAt && (
                        <Button size="small" disabled={retryingId === item.id} onClick={() => void retryLine(item)}>
                          {retryingId === item.id ? "กำลังส่ง..." : "ส่งเข้า LINE"}
                        </Button>
                      )}
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

      <Dialog open={form !== null} onClose={() => !isSaving && !isUploading && closeForm()} fullWidth maxWidth="sm">
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
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>รูปภาพ (ไม่บังคับ)</Typography>
                {(isUploading || form.imageUrl) && (
                  <Box sx={{
                    width: "100%", height: 200, mb: 1, borderRadius: 1, border: 1, borderColor: "divider",
                    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", bgcolor: "grey.50",
                  }}>
                    {isUploading
                      ? <CircularProgress size={28} />
                      : <Box component="img" src={form.imageUrl} alt="ตัวอย่างรูปประกาศ" sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />}
                  </Box>
                )}
                <Stack direction="row" spacing={1}>
                  <Button component="label" variant="outlined" size="small" disabled={isSaving || isUploading}>
                    {isUploading ? "กำลังอัปโหลด..." : form.imageUrl ? "เปลี่ยนรูป" : "เลือกรูปจากเครื่อง"}
                    <input hidden type="file" accept={UPLOAD_IMAGE_TYPES.join(",")} onChange={(event) => void handleImageChange(event)} />
                  </Button>
                  {form.imageUrl && !isUploading && (
                    <Button size="small" color="error" disabled={isSaving} onClick={() => setForm({ ...form, imageUrl: "" })}>ลบรูป</Button>
                  )}
                </Stack>
                {uploadError
                  ? <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>{uploadError}</Typography>
                  : <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>JPG, PNG หรือ WebP รูปใหญ่ระบบจะย่อให้อัตโนมัติ</Typography>}
              </Box>
              <TextField label="หมดอายุเมื่อ (ไม่บังคับ)" type="datetime-local" value={form.expiresAt} fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
              <FormControlLabel
                control={<Switch checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />}
                label={form.isPublished ? "เผยแพร่ให้ลูกค้าเห็นทันที" : "บันทึกเป็นฉบับร่าง (ลูกค้ายังไม่เห็น)"} />
              {form.isPublished && !isExpired(form.expiresAt || null) && !items.find((item) => item.id === form.id)?.lineNotifiedAt && (
                <Alert severity="info">
                  เมื่อบันทึก ระบบจะส่งประกาศนี้เข้าแชท LINE ของลูกค้าทุกคนที่เป็นเพื่อนกับร้าน (ส่งครั้งเดียว แก้ไขภายหลังจะไม่ส่งซ้ำ)
                </Alert>
              )}
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={closeForm} disabled={isSaving || isUploading}>ยกเลิก</Button>
          <Button variant="contained" onClick={() => void save()} disabled={isSaving || isUploading}>
            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
