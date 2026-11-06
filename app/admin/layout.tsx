"use client";

import { usePathname } from "next/navigation";
import { AdminSessionProvider } from "./AdminSessionContext";
import AdminSideBar from "./components/AdminSideBar";

function AdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {pathname !== "/admin/login" && <AdminSideBar />}
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
