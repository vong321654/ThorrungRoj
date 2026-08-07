import type { ReactNode } from "react";
import ClientOnlyProductShell from "./_shared/ClientOnlyProductShell";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return <ClientOnlyProductShell>{children}</ClientOnlyProductShell>;
}