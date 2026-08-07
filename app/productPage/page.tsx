import type { Metadata } from "next";
import ClientOnlyProductCatalog from "./_presentation/ClientOnlyProductCatalog";

export const metadata: Metadata = {
  title: "รายการถังแก๊ส | ก๊าซทอรุ่งโรจน์",
};

export default function ProductPage() {
  return <ClientOnlyProductCatalog />;
}