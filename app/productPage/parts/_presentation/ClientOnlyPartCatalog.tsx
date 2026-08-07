"use client";

import dynamic from "next/dynamic";

const PartCatalogView = dynamic(() => import("./PartCatalogView"), {
  ssr: false,
  loading: () => <div style={{ padding: 24, fontFamily: "inherit" }}>กำลังโหลด...</div>,
});

export default PartCatalogView;
