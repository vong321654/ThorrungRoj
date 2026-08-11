import type { Metadata } from "next";
import CheckoutView from "./CheckoutView";

export const metadata: Metadata = {
  title: "ยืนยันคำสั่งซื้อ | ก๊าซทอรุ่งโรจน์",
};

export default function CheckoutPage() {
  return <CheckoutView />;
}
