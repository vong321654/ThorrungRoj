"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import type { DELIVERYDRIVER, DELIVERYJOB, DELIVERYSTATUS } from "@/app/models/delivery";
import { ADMINROLE } from "@/app/models/admin";
import { useRequireAdmin } from "../useRequireAdmin";

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
  onUpdate: (orderId: string, body: Record<string, unknown>) => Promise<void>;
};

function JobCard({ job, drivers, canAssign, busy, onUpdate }: JobCardProps) {
  const tracking = job.tracking;
  const [eta, setEta] = useState(tracking?.estimatedMinutes != null ? String(tracking.estimatedMinutes) : "");
  const status = tracking?.status ?? "pending";

  function etaValue() {
    return eta.trim() === "" ? null : Number(eta);
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
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
            <Button size="small" variant="outlined" disabled={busy || eta.trim() === ""}
              onClick={() => void onUpdate(job.orderId, { estimatedMinutes: etaValue() })}>
              อัปเดตเวลา
            </Button>
            {status === "pending" && (
              <Button size="small" variant="contained" disabled={busy || eta.trim() === ""}
                onClick={() => void onUpdate(job.orderId, { status: "inTransit", estimatedMinutes: etaValue() })}>
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
          {status === "pending" && eta.trim() === "" && (
            <Typography variant="caption" color="text.secondary">กรอกเวลาที่คาดว่าจะถึง แล้วกด &quot;เริ่มจัดส่ง&quot;</Typography>
          )}
          {status === "delivered" && (
            <Alert severity="info">ส่งถึงลูกค้าแล้ว รอแอดมินยืนยัน &quot;จัดส่งแล้ว&quot; ในหน้าคำสั่งซื้อเพื่อตัดสต๊อก</Alert>
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
  const [isLoading, setIsLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

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
      const scope = isManager ? "all" : "mine";
      setJobs((await request<DELIVERYJOB[]>(`/api/delivery?scope=${scope}`)) ?? []);
      if (isManager) setDrivers((await request<DELIVERYDRIVER[]>("/api/delivery?drivers=1")) ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดงานจัดส่งได้");
    } finally {
      setIsLoading(false);
    }
  }, [request, isManager]);

  useEffect(() => {
    if (isAllowed) void load();
  }, [isAllowed, load]);

  async function update(orderId: string, body: Record<string, unknown>) {
    setBusyOrderId(orderId);
    setError(null);
    try {
      await request("/api/delivery", { method: "PATCH", body: JSON.stringify({ orderId, ...body }) });
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "ไม่สามารถอัปเดตงานจัดส่งได้");
    } finally {
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
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
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
            onUpdate={update}
          />
        ))}
      </Stack>
    </Box>
  );
}
