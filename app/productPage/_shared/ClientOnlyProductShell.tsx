"use client";

import dynamic from "next/dynamic";

const ProductShell = dynamic(() => import("./ProductShell"), {
  ssr: false,
  loading: () => <div style={{ padding: 24, fontFamily: "inherit" }}>กำลังโหลด...</div>,
});

export default ProductShell;