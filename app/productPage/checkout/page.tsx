import type { Metadata } from "next";
import CheckoutView from "./CheckoutView";

export const metadata: Metadata = {
  title: "ยืนยันคำสั่งซื้อ | ร้านแก๊สท.รุ่งโรจน์",
};

export default function CheckoutPage() {
  return <CheckoutView />;
}
