import type { Metadata } from "next";
import ClientOnlyPartCatalog from "./_presentation/ClientOnlyPartCatalog";

export const metadata: Metadata = {
  title: "รายการอะไหล่แก๊ส | ก๊าซทอรุ่งโรจน์",
};

export default function PartsPage() {
  return <ClientOnlyPartCatalog />;
}
