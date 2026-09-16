"use client";

import { usePathname } from "next/navigation";
import { AdminSessionProvider } from "./AdminSessionContext";
import AdminSideBar from "./components/AdminSideBar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const menuItems = [
    { name: "สินค้า", link: "/admin/product" },
    { name: "คลังสินค้า", link: "/admin/inventory" },
    { name: "คำสั่งซื้อ", link: "/admin/orders" },
    { name: "หนี้ค้าง", link: "/admin/debts" },
    { name: "ผู้ใช้", link: "/admin/users" },
  ];

  return (
    <div className="" style={{ display: "flex", minHeight: "100vh" }}>
      {pathname !== "/admin/login" && <AdminSideBar HeaderName="Admin Panel" menuItems={menuItems} />}
      <AdminSessionProvider>{children}</AdminSessionProvider>
    </div>
  );
}
