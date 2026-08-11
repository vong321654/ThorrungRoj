"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { createClient } from "@/app/api/util/supabase/client";
import type { ApiResult } from "@/app/api/response";
import type { OrderRecord, PaymentMethod } from "@/app/models/order";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "เงินสด",
  qrScan: "สแกน QR",
  pendingPayment: "ค้างชำระ",
  pendingCart: "ค้างถัง",
};

const SALE_TYPE_LABELS = {
  sell: "ซื้อถัง",
  exchange: "เปลี่ยนถัง",
  refill: "เติมแก๊ส",
} as const;

function formatBaht(value: number) {
  return `${value.toLocaleString("th-TH")} บาท`;
}

export default function OrdersView() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setCreatedOrderId(new URLSearchParams(window.location.search).get("created"));

    async function loadOrders() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          router.replace("/login");
          return;
        }

        const response = await fetch("/api/orders", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = (await response.json()) as ApiResult<OrderRecord[]>;
        if (!response.ok || result.status === "error") throw new Error(result.message);
        if (isMounted) setOrders(result.results);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดคำสั่งซื้อได้");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadOrders();
    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <Container component="main" maxWidth="md" sx={{ py: 4, flexGrow: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>ประวัติคำสั่งซื้อ</Typography>
        <Button variant="outlined" onClick={() => router.push("/productPage")}>เลือกสินค้า</Button>
      </Box>

      {createdOrderId && (
        <Alert severity="success" sx={{ mb: 2 }}>
          บันทึกคำสั่งซื้อเรียบร้อยแล้ว เลขที่ {createdOrderId}
        </Alert>
      )}
      {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}

      {isLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={180} />
          <Skeleton variant="rounded" height={180} />
        </Stack>
      ) : orders.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">ยังไม่มีประวัติคำสั่งซื้อ</Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {orders.map((order) => (
            <Paper key={order.id} sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>เลขที่ {order.id}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(order.createdAt).toLocaleString("th-TH")}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip size="small" label={`คำสั่งซื้อ: ${order.status}`} />
                  <Chip size="small" color="primary" label={`ชำระเงิน: ${order.paymentStatus}`} />
                </Stack>
              </Box>
              <Divider sx={{ my: 1.5 }} />
              {(order.orderItems ?? []).map((item) => (
                <Box key={item.id} sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.5 }}>
                  <Typography variant="body2">
                    {item.productNameSnapshot} ({SALE_TYPE_LABELS[item.saleType]}) × {item.quantity}
                  </Typography>
                  <Typography variant="body2">{formatBaht(item.totalPrice)}</Typography>
                </Box>
              ))}
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  {order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] : "ยังไม่เลือกวิธีชำระเงิน"}
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{formatBaht(order.totalAmount)}</Typography>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}
    </Container>
  );
}
