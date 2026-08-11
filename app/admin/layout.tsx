import { AdminSessionProvider } from "./AdminSessionContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminSessionProvider>{children}</AdminSessionProvider>;
}
