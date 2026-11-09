"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
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
import { isInDeliveryArea, OUT_OF_AREA_MESSAGE, type DELIVERYLOCATION } from "@/app/util/deliveryLocation";
import DeliveryLocationPicker from "./DeliveryLocationPicker";

type InventoryItem = {
  productId: number | string;
  stockStatus: string | null;
  quantityAvailable: number | string | null;
};

const PAYMENT_OPTIONS: Array<{ value: PAYMENTMETHOD; label: string; hint: string }> = [
  { value: PAYMENTMETHOD.QR_SCAN, label: "สแกนจ่าย (QR)", hint: "โอนผ่าน QR แล้วแนบสลิปในหน้าคำสั่งซื้อ รอร้านตรวจสอบ" },
  { value: PAYMENTMETHOD.CASH, label: "จ่ายสด", hint: "ชำระเงินสดกับคนส่งเมื่อรับสินค้า" },
  { value: PAYMENTMETHOD.PENDING_PAYMENT, label: "ค้างชำระ", hint: "รับสินค้าก่อน แล้วชำระเงินภายหลังตามที่ตกลงกับร้าน" },
  { value: PAYMENTMETHOD.PENDING_CART, label: "ค้างถัง", hint: "สำหรับรายการเปลี่ยนถัง: รับถังเต็มก่อน แล้วนำถังเปล่ามาคืนภายหลัง" },
  { value: PAYMENTMETHOD.PENDING_BOTH, label: "ค้างทั้งถังและเงิน", hint: "สำหรับรายการเปลี่ยนถัง: รับถังเต็มก่อน แล้วชำระเงินและนำถังเปล่ามาคืนภายหลัง" },
];

const DEBT_METHODS = [PAYMENTMETHOD.PENDING_PAYMENT, PAYMENTMETHOD.PENDING_CART, PAYMENTMETHOD.PENDING_BOTH];

/**
 * วิธีชำระที่เลือกไม่ได้ตามประเภทการซื้อในตะกร้า
 * - ซื้อถัง (sell) และฝากเติม (refill): ห้ามค้างทุกแบบ ต้องจ่ายสดหรือสแกนจ่ายเท่านั้น
 */
function getDisabledPaymentMethods(saleTypes: Array<string | null | undefined>) {
  const disabled = new Map<PAYMENTMETHOD, string>();
  if (saleTypes.includes("refill")) {
    for (const method of DEBT_METHODS) disabled.set(method, "ไม่สามารถเลือกได้เมื่อมีรายการฝากเติม");
  }
  if (saleTypes.includes("sell")) {
    for (const method of DEBT_METHODS) disabled.set(method, "ไม่สามารถเลือกได้เมื่อมีรายการซื้อถัง");
  }
  return disabled;
}

const sectionSx = { p: { xs: 2, sm: 2.5 } };

function formatBaht(value: number) {
  return `${value.toLocaleString("th-TH")} บาท`;
}

export default function CheckoutView() {
  const cart = useCart();
  const router = useRouter();
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [note, setNote] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState<DELIVERYLOCATION | null>(null);
  // ไม่เลือกค่าเริ่มต้นให้ ลูกค้าต้องตัดสินใจเองว่าจะจ่ายแบบไหน
  const [paymentMethod, setPaymentMethod] = useState<PAYMENTMETHOD | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outOfAreaOpen, setOutOfAreaOpen] = useState(false);

  // เตือนทันทีที่ปักหมุดนอกพื้นที่ ไม่ต้องรอให้ลูกค้ากรอกจนเสร็จแล้วค่อยรู้ตอนกดสั่งซื้อ
  function handleLocationChange(location: DELIVERYLOCATION | null) {
    setDeliveryLocation(location);
    if (location && !isInDeliveryArea(location)) setOutOfAreaOpen(true);
  }

  const disabledPaymentMethods = getDisabledPaymentMethods(cart.cartLines.map((line) => line.item.saleType));
  // ถ้าตะกร้าเปลี่ยนจนวิธีที่เลือกไว้ใช้ไม่ได้ ให้ถือว่ายังไม่ได้เลือก
  const selectedPaymentMethod =
    paymentMethod && !disabledPaymentMethods.has(paymentMethod) ? paymentMethod : "";

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
    if (!deliveryLocation) {
      setErrorMessage("กรุณาปักหมุดจุดส่งของก่อนสั่งซื้อ");
      return;
    }
    if (!isInDeliveryArea(deliveryLocation)) {
      setOutOfAreaOpen(true);
      return;
    }
    if (!selectedPaymentMethod) {
      setErrorMessage("กรุณาเลือกวิธีชำระเงิน");
      return;
    }

    setIsSubmitting(true);
    try {
      const inventoryTrackedLines = cart.cartLines.filter(
        (line) => line.item.availableQuantity !== null,
      );
      if (inventoryTrackedLines.length > 0) {
        const inventoryResponse = await fetch("/api/inventory", { cache: "no-store" });
        const inventoryResult = (await inventoryResponse.json()) as APIRESULT<InventoryItem[]>;
        if (!inventoryResponse.ok || inventoryResult.status === "error") {
          throw new Error("ไม่สามารถตรวจสอบจำนวนสินค้าในคลังได้ กรุณาลองใหม่อีกครั้ง");
        }

        const availableByProduct = new Map<number, number>();
        for (const inventoryItem of inventoryResult.results) {
          if (inventoryItem.stockStatus !== "full") continue;
          const productId = Number(inventoryItem.productId);
          availableByProduct.set(
            productId,
            (availableByProduct.get(productId) ?? 0) + Number(inventoryItem.quantityAvailable ?? 0),
          );
        }

        const requestedByProduct = new Map<number, number>();
        for (const line of inventoryTrackedLines) {
          const productId = line.item.productId as number;
          requestedByProduct.set(
            productId,
            (requestedByProduct.get(productId) ?? 0) + line.quantity,
          );
        }
        const unavailableLine = inventoryTrackedLines.find((line) => {
          const productId = line.item.productId as number;
          return (requestedByProduct.get(productId) ?? 0) > (availableByProduct.get(productId) ?? 0);
        });
        if (unavailableLine) {
          const available = availableByProduct.get(unavailableLine.item.productId as number) ?? 0;
          throw new Error(
            `${unavailableLine.item.name} มีสินค้าเหลือ ${available.toLocaleString("th-TH")} ชิ้น กรุณาลดจำนวนในตะกร้า`,
          );
        }
      }

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
        body: JSON.stringify({
          items,
          deliveryAddress,
          note,
          paymentMethod: selectedPaymentMethod,
          deliveryLat: deliveryLocation.lat,
          deliveryLng: deliveryLocation.lng,
        }),
      });
      const result = (await response.json()) as APIRESULT<ORDERRECORD>;
      if (!response.ok || result.status === "error") {
        throw new Error(result.message);
      }

      cart.clearCart();
      const orderId = encodeURIComponent(result.results.id);
      // สแกนจ่าย: พาไปหน้ารายละเอียดที่มี QR พร้อมเพย์ทันที ไม่ต้องพึ่งรูป QR ในแชท LINE อย่างเดียว
      router.replace(
        selectedPaymentMethod === PAYMENTMETHOD.QR_SCAN
          ? `/productPage/orders/${orderId}`
          : `/productPage/orders?created=${orderId}`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถบันทึกคำสั่งซื้อได้");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (cart.cartLines.length === 0) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 }, flexGrow: 1 }}>
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
    <Container component="main" maxWidth="md" sx={{ py: { xs: 2, sm: 3, md: 4 }, flexGrow: 1 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        ยืนยันคำสั่งซื้อ
      </Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          <Paper sx={sectionSx}>
            <Typography variant="h6" sx={{ mb: 1 }}>รายการสินค้า</Typography>
            {cart.cartLines.map((line) => (
              <Box key={line.item.id} sx={{ py: 1.25 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography sx={{ minWidth: 0, overflowWrap: "anywhere" }}>{line.item.name} × {line.quantity}</Typography>
                  <Typography sx={{ flexShrink: 0, fontWeight: 600, whiteSpace: "nowrap" }}>
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
              ระบบจะตรวจสอบราคาและจำนวนสินค้าในคลังอีกครั้งก่อนบันทึก
            </Typography>
          </Paper>

          <Paper sx={sectionSx}>
            <DeliveryLocationPicker
              value={deliveryLocation}
              onChange={handleLocationChange}
              address={deliveryAddress}
              disabled={isSubmitting}
            />
            <TextField
              label="รายละเอียดที่อยู่ / จุดสังเกต (ไม่บังคับ)"
              helperText="เช่น บ้านเลขที่ ชื่อซอย สีบ้าน ใกล้ร้านอะไร ช่วยให้คนส่งหาเจอง่ายขึ้น"
              value={deliveryAddress}
              onChange={(event) => setDeliveryAddress(event.target.value)}
              multiline
              minRows={2}
              fullWidth
              sx={{ mt: 2 }}
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

          <Paper sx={sectionSx}>
            <FormControl fullWidth>
              <FormLabel>วิธีชำระเงิน</FormLabel>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PAYMENTMETHOD)}
              >
                {PAYMENT_OPTIONS.map((option) => {
                  const disabledReason = disabledPaymentMethods.get(option.value);
                  return (
                    <FormControlLabel
                      key={option.value}
                      value={option.value}
                      control={<Radio />}
                      disabled={Boolean(disabledReason)}
                      label={
                        <Box>
                          <Typography>{option.label}</Typography>
                          <Typography variant="caption" color={disabledReason ? "error" : "text.secondary"}>
                            {disabledReason ?? option.hint}
                          </Typography>
                        </Box>
                      }
                      sx={{ alignItems: "flex-start", mb: 1, mr: 0 }}
                    />
                  );
                })}
              </RadioGroup>
            </FormControl>
          </Paper>

          {/* มือถือปุ่มเรียงแนวตั้ง โดยให้ปุ่มยืนยันอยู่บนสุด */}
          <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1.5} useFlexGap sx={{ justifyContent: "flex-end" }}>
            <Button variant="outlined" onClick={() => router.back()} disabled={isSubmitting}>
              กลับไปแก้ไขตะกร้า
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting || !selectedPaymentMethod}>
              {isSubmitting ? "กำลังบันทึก..." : "ยืนยันคำสั่งซื้อ"}
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Dialog open={outOfAreaOpen} onClose={() => setOutOfAreaOpen(false)} aria-labelledby="outOfAreaTitle">
        <DialogTitle id="outOfAreaTitle">อยู่นอกระยะการจัดส่ง</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {OUT_OF_AREA_MESSAGE} จึงยังสั่งซื้อไม่ได้ กรุณาลากหมุดเข้ามาในวงสีเขียวบนแผนที่ หรือติดต่อร้านโดยตรง
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setOutOfAreaOpen(false)} autoFocus>
            ปักหมุดใหม่
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
