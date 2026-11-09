import "server-only";

import { PAYMENTMETHOD } from "@/app/enums/order";
import { CUSTOMERTYPE } from "@/app/enums/customer";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import { publicUrl, pushLineMessages, type LineMessage } from "./lineBotService";
import { buildPromptPayQrPath } from "./promptPayService";

const SALE_LABELS: Record<string, string> = { sell: "ซื้อถัง", exchange: "เปลี่ยนถัง", refill: "ฝากเติม" };

type ORDERNOTIFICATION = {
  orderId: string;
  userId: string;
  totalAmount: number;
  paymentMethod: PAYMENTMETHOD;
  customerType: CUSTOMERTYPE;
  items: Array<{ productNameSnapshot: string; quantity: number; saleType: string }>;
};

function paymentInstruction(method: PAYMENTMETHOD, hasQrImage: boolean) {
  switch (method) {
    case PAYMENTMETHOD.QR_SCAN:
      return hasQrImage
        ? "วิธีชำระ: สแกนจ่าย\nสแกน QR พร้อมเพย์ด้านล่าง ยอดเงินจะขึ้นให้อัตโนมัติ แล้วแนบสลิปที่หน้าคำสั่งซื้อครับ"
        : "วิธีชำระ: สแกนจ่าย\nเปิดหน้าคำสั่งซื้อเพื่อชำระเงินและแนบสลิปครับ";
    case PAYMENTMETHOD.CASH:
      return "วิธีชำระ: จ่ายสด\nชำระเงินสดกับคนส่งเมื่อรับสินค้าครับ";
    case PAYMENTMETHOD.PENDING_PAYMENT:
      return "วิธีชำระ: ค้างชำระ\nร้านจะบันทึกยอดค้างเมื่อจัดส่งแล้วครับ";
    case PAYMENTMETHOD.PENDING_CART:
      return "วิธีชำระ: ค้างถัง\nร้านจะบันทึกถังค้างคืนเมื่อจัดส่งแล้ว กรุณาเตรียมถังเปล่าไว้คืนภายหลังครับ";
    case PAYMENTMETHOD.PENDING_BOTH:
      return "วิธีชำระ: ค้างทั้งถังและเงิน\nร้านจะบันทึกยอดค้างและถังค้างคืนเมื่อจัดส่งแล้ว กรุณาเตรียมถังเปล่าไว้คืนภายหลังครับ";
  }
}

/**
 * แจ้งสรุปออเดอร์เข้าแชท LINE ของลูกค้ากับร้าน
 * ออเดอร์บันทึกสำเร็จไปแล้ว ถ้าส่งไม่ได้ (เช่น ลูกค้าบล็อกร้าน) ต้องไม่ทำให้การสั่งซื้อล้มเหลว จึงไม่ throw
 */
export async function notifyOrderCreated(order: ORDERNOTIFICATION) {
  try {
    const { data: customer, error } = await createAdminClient()
      .from("users")
      .select("lineUserId")
      .eq("id", order.userId)
      .maybeSingle();
    if (error || !customer?.lineUserId) throw new Error("Customer LINE id was not found");

    const qrPath = order.paymentMethod === PAYMENTMETHOD.QR_SCAN ? buildPromptPayQrPath(order.orderId) : null;
    const qrUrl = qrPath ? publicUrl(qrPath) : null;
    if (order.paymentMethod === PAYMENTMETHOD.QR_SCAN && !qrUrl) {
      // eslint-disable-next-line no-console -- ลูกค้าจะไม่เห็น QR ในแชท ต้องให้รู้สาเหตุจาก log
      console.error(
        "[order notify] QR image was not sent:",
        qrPath ? "no public https domain (set LINE_PUBLIC_BASE_URL or deploy to Vercel)" : "PROMPTPAY_PHONE or PROMPTPAY_QR_SECRET is missing or invalid",
      );
    }

    const lines = order.items.map(
      (item) => `• ${item.productNameSnapshot} (${SALE_LABELS[item.saleType] ?? item.saleType}) × ${item.quantity}`,
    );
    const text = [
      "รับคำสั่งซื้อแล้วครับ",
      `เลขที่ ${order.orderId.slice(0, 8)}`,
      ...lines,
      `ยอดรวม ${order.totalAmount.toLocaleString("th-TH")} บาท${order.customerType === CUSTOMERTYPE.SHOP ? " (ราคาร้านค้า)" : ""}`,
      "",
      paymentInstruction(order.paymentMethod, qrUrl !== null),
    ].join("\n");

    const messages: LineMessage[] = [{ type: "text", text }];
    if (qrUrl) messages.push({ type: "image", originalContentUrl: qrUrl, previewImageUrl: qrUrl });
    await pushLineMessages(customer.lineUserId as string, messages);
  } catch (error) {
    // eslint-disable-next-line no-console -- ให้เห็น error ใน Vercel logs
    console.error("[order notify]", order.orderId, error);
  }
}
