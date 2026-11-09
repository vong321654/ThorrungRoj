import type { Metadata } from "next";
import ClientOnlyProductCatalog from "./_presentation/ClientOnlyProductCatalog";

export const metadata: Metadata = {
  title: "รายการถังแก๊ส | ร้านแก๊สท.รุ่งโรจน์",
};

export default function ProductPage() {
  return <ClientOnlyProductCatalog />;
}