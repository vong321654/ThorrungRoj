"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCart } from "@/app/productPage/_shared/CartContext";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import type { CURRENTUSER } from "@/app/models/user";
import { PAYMENTMETHOD, type ORDERRECORD } from "@/app/models/order";

const PAYMENT_OPTIONS: Array<{ value: PAYMENTMETHOD; label: string }> = [
  { value: PAYMENTMETHOD.CASH, label: "ชำระเงินสด" },
  { value: PAYMENTMETHOD.QR_SCAN, label: "สแกน QR" },
];

function formatBaht(value: number) {
  return `${value.toLocaleString("th-TH")} บาท`;
}

export default function CheckoutView() {
  const cart = useCart();
  const router = useRouter();
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PAYMENTMETHOD>(PAYMENTMETHOD.CASH);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCustomer() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json()) as APIRESULT<CURRENTUSER | null>;
      if (!isMounted) return;
      if (result.status === "success" && result.results?.address) {
        setDeliveryAddress(result.results.address);
      }
    }

    void loadCustomer();
    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const items = cart.cartLines.flatMap((line) => {
      if (
        !Number.isInteger(line.item.productId) ||
        (line.item.productId ?? 0) <= 0 ||
        (line.item.saleType !== "sell" &&
          line.item.saleType !== "exchange" &&
          line.item.saleType !== "refill")
      ) return [];
      return [{
        productId: line.item.productId as number,
        quantity: line.quantity,
        saleType: line.item.saleType,
      }];
    });

    if (items.length !== cart.cartLines.length || items.length === 0) {
      setErrorMessage("ตะกร้ามีสินค้าที่ยังไม่พร้อมสั่งซื้อ");
      return;
    }
    if (!deliveryAddress.trim()) {
      setErrorMessage("กรุณาระบุที่อยู่จัดส่ง");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ items, deliveryAddress, note, paymentMethod }),
      });
      const result = (await response.json()) as APIRESULT<ORDERRECORD>;
      if (!response.ok || result.status === "error") {
        throw new Error(result.message);
      }

      cart.clearCart();
      router.replace(`/productPage/orders?created=${encodeURIComponent(result.results.id)}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถบันทึกคำสั่งซื้อได้");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (cart.cartLines.length === 0) {
    return (
      <Container maxWidth="sm" sx={{ py: 6, flexGrow: 1 }}>
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="h6">ไม่มีสินค้าในตะกร้า</Typography>
          <Button sx={{ mt: 2 }} variant="contained" onClick={() => router.push("/productPage")}>
            เลือกสินค้า
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="md" sx={{ py: 4, flexGrow: 1 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        ยืนยันคำสั่งซื้อ
      </Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>รายการสินค้า</Typography>
            {cart.cartLines.map((line) => (
              <Box key={line.item.id} sx={{ py: 1.25 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography>{line.item.name} × {line.quantity}</Typography>
                  <Typography sx={{ fontWeight: 600 }}>
                    {formatBaht((line.item.price ?? 0) * line.quantity)}
                  </Typography>
                </Box>
                <Divider sx={{ mt: 1.25 }} />
              </Box>
            ))}
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>รวมทั้งหมด</Typography>
              <Typography sx={{ fontWeight: 700 }}>{formatBaht(cart.cartTotal)}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              ระบบจะตรวจสอบและคำนวณราคาอีกครั้งก่อนบันทึก
            </Typography>
          </Paper>

          <Paper sx={{ p: 2.5 }}>
            <TextField
              label="ที่อยู่จัดส่ง"
              value={deliveryAddress}
              onChange={(event) => setDeliveryAddress(event.target.value)}
              multiline
              minRows={3}
              fullWidth
              required
            />
            <TextField
              label="หมายเหตุ"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              multiline
              minRows={2}
              fullWidth
              sx={{ mt: 2 }}
            />
          </Paper>

          <Paper sx={{ p: 2.5 }}>
            <FormControl>
              <FormLabel>วิธีชำระเงิน</FormLabel>
              <RadioGroup
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PAYMENTMETHOD)}
              >
                {PAYMENT_OPTIONS.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    control={<Radio />}
                    label={option.label}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Paper>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "flex-end" }}>
            <Button variant="outlined" onClick={() => router.back()} disabled={isSubmitting}>
              กลับไปแก้ไขตะกร้า
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? "กำลังบันทึก..." : "ยืนยันคำสั่งซื้อ"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
}
