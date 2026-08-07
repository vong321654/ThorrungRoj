"use client";

import dynamic from "next/dynamic";

const ProductCatalogView = dynamic(() => import("./ProductCatalogView"), {
  ssr: false,
  loading: () => <div style={{ padding: 24, fontFamily: "inherit" }}>กำลังโหลด...</div>,
});

export default ProductCatalogView;