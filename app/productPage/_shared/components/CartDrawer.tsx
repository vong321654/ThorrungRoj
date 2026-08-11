"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { CartLine } from "../domain/cartItem";

type CartDrawerProps = {
  open: boolean;
  lines: CartLine[];
  total: number;
  onClose: () => void;
  onRemove: (itemId: string) => void;
  onIncrease: (itemId: string) => void;
  onDecrease: (itemId: string) => void;
  onCheckout: () => void;
};

function formatBaht(amount: number | null) {
  return amount !== null ? `${amount.toLocaleString("th-TH")} บาท` : "-- บาท";
}

function getSaleTypeLabel(saleType: CartLine["item"]["saleType"]) {
  if (saleType === "sell") return "ซื้อถัง";
  if (saleType === "exchange") return "เปลี่ยนถัง";
  if (saleType === "refill") return "เติมแก๊ส";
  return "ยังไม่พร้อมจำหน่าย";
}

export default function CartDrawer({
  open,
  lines,
  total,
  onClose,
  onRemove,
  onIncrease,
  onDecrease,
  onCheckout,
}: CartDrawerProps) {
  const canCheckout =
    lines.length > 0 &&
    lines.every(
      (line) =>
        Number.isInteger(line.item.productId) &&
        (line.item.productId ?? 0) > 0 &&
        (line.item.saleType === "sell" ||
          line.item.saleType === "exchange" ||
          line.item.saleType === "refill") &&
        typeof line.item.price === "number" &&
        line.item.price > 0,
    );

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 320, p: 2, display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">ตะกร้าสินค้า</Typography>
          <IconButton onClick={onClose} aria-label="ปิดตะกร้า" size="small">
            ×
          </IconButton>
        </Box>
        <Divider sx={{ my: 1.5 }} />

        {lines.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
            ยังไม่มีสินค้าในตะกร้า
          </Typography>
        ) : (
          <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
            {lines.map((line) => (
              <Box key={line.item.id} sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{line.item.name}</Typography>
                  <Button size="small" color="error" sx={{ minWidth: 0 }} onClick={() => onRemove(line.item.id)}>
                    ลบ
                  </Button>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {getSaleTypeLabel(line.item.saleType)} · {formatBaht(line.item.price)} / ชิ้น
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={() => onDecrease(line.item.id)}
                    aria-label={`ลดจำนวน ${line.item.name}`}
                    sx={{ border: "1px solid", borderColor: "divider" }}
                  >
                    −
                  </IconButton>
                  <Typography sx={{ minWidth: 20, textAlign: "center" }}>{line.quantity}</Typography>
                  <IconButton
                    size="small"
                    onClick={() => onIncrease(line.item.id)}
                    aria-label={`เพิ่มจำนวน ${line.item.name}`}
                    sx={{ border: "1px solid", borderColor: "divider" }}
                  >
                    +
                  </IconButton>
                  <Typography sx={{ ml: "auto", fontWeight: 600 }}>
                    {line.item.price !== null ? formatBaht(line.item.price * line.quantity) : "-- บาท"}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 1.5 }} />
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography sx={{ fontWeight: 700 }}>รวมทั้งหมด</Typography>
          <Typography sx={{ fontWeight: 700 }}>{formatBaht(total)}</Typography>
        </Box>
        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
          disabled={!canCheckout}
          onClick={onCheckout}
        >
          ดำเนินการสั่งซื้อ
        </Button>
        {lines.length > 0 && !canCheckout && (
          <Typography variant="caption" color="error" sx={{ mt: 1, textAlign: "center" }}>
            กรุณานำสินค้าที่ไม่มีราคาหรือยังไม่เชื่อมกับฐานข้อมูลออกจากตะกร้า
          </Typography>
        )}
      </Box>
    </Drawer>
  );
}
