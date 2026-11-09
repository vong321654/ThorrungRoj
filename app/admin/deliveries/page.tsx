"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import type { DELIVERYDRIVER, DELIVERYETADETAIL, DELIVERYJOB, DELIVERYSTATUS } from "@/app/models/delivery";
import { ADMINROLE } from "@/app/models/admin";
import { useRequireAdmin } from "../useRequireAdmin";
import { useAutoRefresh } from "../useAutoRefresh";
import { googleMapsDirectionsUrl, googleMapsSearchUrl } from "@/app/util/deliveryLocation";

const DELIVERY_LABELS: Record<DELIVERYSTATUS, string> = {
  pending: "รอจัดส่ง",
  inTransit: "กำลังนำส่ง",
  delivered: "ส่งถึงแล้ว",
};
const ORDER_LABELS: Record<string, string> = {
  pending: "รอดำเนินการ", preparing: "กำลังเตรียมสินค้า", delivering: "กำลังจัดส่ง",
};
const PAYMENT_LABELS: Record<string, string> = {
  cash: "เงินสด", qrScan: "สแกน QR", pendingPayment: "ค้างชำระ", pendingCart: "ค้างถัง", pendingBoth: "ค้างทั้งถังและเงิน",
};

type JobCardProps = {
  job: DELIVERYJOB;
  drivers: DELIVERYDRIVER[];
  canAssign: boolean;
  busy: boolean;
  isNew: boolean;
  onUpdate: (orderId: string, body: Record<string, unknown>) => Promise<void>;
};

function JobCard({ job, drivers, canAssign, busy, isNew, onUpdate }: JobCardProps) {
  const tracking = job.tracking;
  const [eta, setEta] = useState(tracking?.estimatedMinutes != null ? String(tracking.estimatedMinutes) : "");
  const status = tracking?.status ?? "pending";
  // มีหมุด = ระบบคำนวณเวลาจากร้านถึงบ้านลูกค้าได้ ไม่มีหมุดต้องกรอกเวลาเอง
  const hasPin = job.deliveryLat !== null && job.deliveryLng !== null;
  const etaEmpty = eta.trim() === "";

  function etaValue() {
    return etaEmpty ? null : Number(eta);
  }

  // กรอกเวลาเองแล้วใช้ค่าที่กรอก ยังไม่กรอกและมีหมุดให้ระบบคำนวณ
  function startEta() {
    return etaEmpty && hasPin ? "auto" : etaValue();
  }

  return (
    <Card variant="outlined" sx={isNew ? { borderColor: "primary.main", borderWidth: 2 } : undefined}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            {isNew && <Chip size="small" color="primary" label="ใหม่" />}
            <Typography sx={{ fontWeight: 700 }}>{job.customerName ?? "ลูกค้า"}</Typography>
            <Chip size="small" label={ORDER_LABELS[job.orderStatus] ?? job.orderStatus} />
            <Chip size="small" color={status === "inTransit" ? "primary" : status === "delivered" ? "success" : "default"}
              label={DELIVERY_LABELS[status]} />
            <Chip size="small" variant="outlined" label={PAYMENT_LABELS[job.paymentMethod ?? ""] ?? "-"} />
          </Stack>

          {job.customerPhone && (
            <Typography variant="body2">โทร: <a href={`tel:${job.customerPhone}`}>{job.customerPhone}</a></Typography>
          )}
          <Typography variant="body2">ที่อยู่: {job.deliveryAddress ?? "-"}</Typography>
          {job.deliveryLat !== null && job.deliveryLng !== null ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              <Button size="small" variant="contained" component="a" target="_blank" rel="noopener noreferrer"
                href={googleMapsDirectionsUrl({ lat: job.deliveryLat, lng: job.deliveryLng })}>
                นำทางไปหมุดลูกค้า
              </Button>
              <Typography variant="caption" color="text.secondary">ลูกค้าปักหมุดไว้</Typography>
            </Stack>
          ) : job.deliveryAddress ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              <Button size="small" variant="outlined" component="a" target="_blank" rel="noopener noreferrer"
                href={googleMapsSearchUrl(job.deliveryAddress)}>
                ค้นหาที่อยู่ในแผนที่
              </Button>
              <Typography variant="caption" color="text.secondary">ลูกค้าไม่ได้ปักหมุด ตำแหน่งอาจไม่ตรง</Typography>
            </Stack>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {job.items.map((item) => `${item.name} × ${item.quantity}`).join(", ") || "-"}
            {" · "}{job.totalAmount.toLocaleString("th-TH")} บาท
          </Typography>

          {canAssign && (
            <TextField select size="small" label="คนส่ง" value={tracking?.driverId ?? ""} disabled={busy}
              onChange={(event) => void onUpdate(job.orderId, { driverId: event.target.value || null })}>
              <MenuItem value="">ยังไม่มอบหมาย</MenuItem>
              {drivers.map((driver) => <MenuItem key={driver.id} value={driver.id}>{driver.name}</MenuItem>)}
            </TextField>
          )}
          {!canAssign && tracking?.driverName && (
            <Typography variant="body2">คนส่ง: {tracking.driverName}</Typography>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
            <TextField size="small" label="จะถึงในอีก (นาที)" type="number" value={eta} disabled={busy}
              slotProps={{ htmlInput: { min: 0, max: 600 } }} sx={{ maxWidth: 200 }}
              onChange={(event) => setEta(event.target.value)} />
            <Button size="small" variant="outlined" disabled={busy || etaEmpty}
              onClick={() => void onUpdate(job.orderId, { estimatedMinutes: etaValue() })}>
              อัปเดตเวลา
            </Button>
            {hasPin && status !== "delivered" && (
              <Button size="small" variant="outlined" color="secondary" disabled={busy}
                onClick={() => void onUpdate(job.orderId, { estimatedMinutes: "auto" })}>
                คำนวณเวลาอัตโนมัติ
              </Button>
            )}
            {status === "pending" && (
              <Button size="small" variant="contained" disabled={busy || (etaEmpty && !hasPin)}
                onClick={() => void onUpdate(job.orderId, { status: "inTransit", estimatedMinutes: startEta() })}>
                เริ่มจัดส่ง
              </Button>
            )}
            {status === "inTransit" && (
              <Button size="small" variant="contained" color="success" disabled={busy}
                onClick={() => void onUpdate(job.orderId, { status: "delivered", estimatedMinutes: null })}>
                ส่งถึงแล้ว
              </Button>
            )}
          </Stack>
          {status === "pending" && etaEmpty && (
            <Typography variant="caption" color="text.secondary">
              {hasPin
                ? "กด \"เริ่มจัดส่ง\" ระบบจะคำนวณเวลาจากร้านถึงหมุดลูกค้าให้ (เวลาขับรถ + เผื่อ 5 นาที) หรือกรอกเวลาเองก็ได้"
                : "ลูกค้าไม่ได้ปักหมุด กรุณากรอกเวลาที่คาดว่าจะถึง แล้วกด \"เริ่มจัดส่ง\""}
            </Typography>
          )}
          {status === "delivered" && (
            // ปกติส่งถึงแล้วออเดอร์จะปิดและหายจากรายการทันที ที่ยังเห็นคือออเดอร์ที่ยังไม่ถูกปิด (เช่น ตัดสต๊อกไม่สำเร็จ)
            <Alert severity="warning" action={
              <Button color="inherit" size="small" disabled={busy}
                onClick={() => void onUpdate(job.orderId, { status: "delivered", estimatedMinutes: null })}>
                ยืนยันอีกครั้ง
              </Button>
            }>
              ส่งถึงลูกค้าแล้ว แต่ออเดอร์ยังไม่ถูกปิด กด &quot;ยืนยันอีกครั้ง&quot; เพื่อตัดสต๊อกและเปลี่ยนออเดอร์เป็นจัดส่งแล้ว
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function DeliveriesPage() {
  const { admin, isAllowed } = useRequireAdmin();
  const isManager = admin?.role === ADMINROLE.ADMIN || admin?.role === ADMINROLE.SUPER_ADMIN;
  const [jobs, setJobs] = useState<DELIVERYJOB[]>([]);
  const [drivers, setDrivers] = useState<DELIVERYDRIVER[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [newJobIds, setNewJobIds] = useState<Set<string>>(new Set());
  // null = ยังไม่เคยโหลด รอบแรกไม่นับว่าเป็นงานใหม่
  const knownJobIdsRef = useRef<Set<string> | null>(null);
  // กำลังกดอัปเดตงานอยู่ ให้รอบอัตโนมัติข้ามไปก่อน update จะโหลดใหม่เองหลังบันทึก
  const busyRef = useRef(false);

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

  // background = รอบอัปเดตอัตโนมัติ ไม่แตะ error เพื่อไม่ลบคำเตือน (เช่น debtWarning) ที่ผู้ใช้ยังอ่านไม่จบ
  const load = useCallback(async (background = false) => {
    try {
      const scope = isManager ? "all" : "mine";
      const loaded = (await request<DELIVERYJOB[]>(`/api/delivery?scope=${scope}`)) ?? [];
      const known = knownJobIdsRef.current;
      if (known) {
        const added = loaded.filter((job) => !known.has(job.orderId)).map((job) => job.orderId);
        if (added.length > 0) setNewJobIds((current) => new Set([...current, ...added]));
      }
      knownJobIdsRef.current = new Set(loaded.map((job) => job.orderId));
      setJobs(loaded);
      if (isManager) setDrivers((await request<DELIVERYDRIVER[]>("/api/delivery?drivers=1")) ?? []);
      if (!background) setError(null);
    } catch (loadError) {
      if (!background) setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดงานจัดส่งได้");
    } finally {
      setIsLoading(false);
    }
  }, [request, isManager]);

  useEffect(() => {
    if (isAllowed) void load();
  }, [isAllowed, load]);

  const refreshInBackground = useCallback(async () => {
    if (!busyRef.current) await load(true);
  }, [load]);
  useAutoRefresh(refreshInBackground, isAllowed);

  async function update(orderId: string, body: Record<string, unknown>) {
    setBusyOrderId(orderId);
    busyRef.current = true;
    setError(null);
    setNotice(null);
    try {
      const saved = await request<{
        debtWarning?: string | null;
        estimatedMinutes?: number | null;
        etaDetail?: DELIVERYETADETAIL | null;
      }>("/api/delivery", { method: "PATCH", body: JSON.stringify({ orderId, ...body }) });
      await load();
      if (saved?.debtWarning) setError(saved.debtWarning);
      // แจ้งที่มาของเวลาที่ระบบคำนวณ ให้คนส่งตัดสินใจได้ว่าจะแก้ทับหรือไม่
      if (saved?.etaDetail && saved.estimatedMinutes != null) {
        const { distanceKm, source, bufferMinutes } = saved.etaDetail;
        setNotice(
          source === "osrm"
            ? `คำนวณได้ ${saved.estimatedMinutes} นาที (ระยะทางถนนจากร้าน ${distanceKm} กม. + เผื่อ ${bufferMinutes} นาที) คำนวณจากร้าน ถ้าออกจากที่อื่นให้แก้เวลาเอง`
            : `บริการเส้นทางไม่ตอบ จึงประมาณจากระยะทางตรงได้ ${saved.estimatedMinutes} นาที (ประมาณ ${distanceKm} กม. + เผื่อ ${bufferMinutes} นาที) ตรวจสอบและแก้เวลาได้`,
        );
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "ไม่สามารถอัปเดตงานจัดส่งได้");
    } finally {
      busyRef.current = false;
      setBusyOrderId(null);
    }
  }

  if (!isAllowed || isLoading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>;

  return (
    <Box component="main" sx={{ p: 4, flexGrow: 1, maxWidth: 900 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5">{isManager ? "งานจัดส่งทั้งหมด" : "งานจัดส่งของฉัน"}</Typography>
        <Button onClick={() => void load()}>รีเฟรช</Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>อัปเดตอัตโนมัติทุก 15 วินาที</Typography>
      {newJobIds.size > 0 && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNewJobIds(new Set())}>
          มีงานจัดส่งใหม่ {newJobIds.size} รายการ (การ์ดที่มีป้าย &quot;ใหม่&quot;)
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      <Stack spacing={2}>
        {jobs.length === 0 && (
          <Alert severity="info">{isManager ? "ไม่มีงานจัดส่งที่ค้างอยู่" : "ยังไม่มีงานที่ได้รับมอบหมาย"}</Alert>
        )}
        {jobs.map((job) => (
          <JobCard
            // key รวมสถานะ เพื่อให้ช่องเวลารีเซ็ตเมื่อข้อมูลจากเซิร์ฟเวอร์เปลี่ยน
            key={`${job.orderId}:${job.tracking?.updatedAt ?? "new"}`}
            job={job}
            drivers={drivers}
            canAssign={isManager}
            busy={busyOrderId === job.orderId}
            isNew={newJobIds.has(job.orderId)}
            onUpdate={update}
          />
        ))}
      </Stack>
    </Box>
  );
}
