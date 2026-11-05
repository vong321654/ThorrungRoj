"use client";

import { usePathname } from "next/navigation";
import { AdminSessionProvider, useAdminSession } from "./AdminSessionContext";
import AdminSideBar from "./components/AdminSideBar";
import { ADMINROLE } from "@/app/models/admin";

const STAFF_MENU = [
  { name: "เวลาทำงาน", link: "/admin/attendance" },
  { name: "งานจัดส่ง", link: "/admin/deliveries" },
];

const ADMIN_MENU = [
  { name: "สินค้า", link: "/admin/product" },
  { name: "คลังสินค้า", link: "/admin/inventory" },
  { name: "คำสั่งซื้อ", link: "/admin/orders" },
  { name: "งานจัดส่ง", link: "/admin/deliveries" },
  { name: "ประกาศ/โปรโมชั่น", link: "/admin/announcements" },
  { name: "หนี้ค้าง", link: "/admin/debts" },
  { name: "ผู้ใช้", link: "/admin/users" },
  { name: "เวลาทำงาน", link: "/admin/attendance" },
];

function AdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin } = useAdminSession();
  // พนักงานทั่วไปเห็นเฉพาะเมนูที่ใช้งานจริง ส่วนแอดมินเห็นครบ
  // ระหว่างรอโหลด session ยังไม่รู้บทบาท จึงไม่แสดงเมนู กันพนักงานเห็นเมนูแอดมินแวบหนึ่ง
  const menuItems = !admin ? [] : admin.role === ADMINROLE.EMPLOYEE ? STAFF_MENU : ADMIN_MENU;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {pathname !== "/admin/login" && <AdminSideBar HeaderName="Admin Panel" menuItems={menuItems} />}
      {children}
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminSessionProvider>
      <AdminFrame>{children}</AdminFrame>
    </AdminSessionProvider>
  );
}
