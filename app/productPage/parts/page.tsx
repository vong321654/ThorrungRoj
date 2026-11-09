import type { Metadata } from "next";
import ClientOnlyPartCatalog from "./_presentation/ClientOnlyPartCatalog";

export const metadata: Metadata = {
  title: "รายการอะไหล่แก๊ส | ร้านแก๊สท.รุ่งโรจน์",
};

export default function PartsPage() {
  return <ClientOnlyPartCatalog />;
}
