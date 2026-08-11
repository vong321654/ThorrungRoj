import type { Metadata } from "next";
import OrdersView from "./OrdersView";

export const metadata: Metadata = {
  title: "ประวัติคำสั่งซื้อ | ก๊าซทอรุ่งโรจน์",
};

export default function OrdersPage() {
  return <OrdersView />;
}
