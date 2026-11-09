import type { Metadata } from "next";
import OrdersView from "./OrdersView";

export const metadata: Metadata = {
  title: "ประวัติคำสั่งซื้อ | ร้านแก๊สท.รุ่งโรจน์",
};

export default function OrdersPage() {
  return <OrdersView />;
}
