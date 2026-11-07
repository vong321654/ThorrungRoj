import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import Header from "./components/Header";
import "./components/UI/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ก๊าซทอรุ่งโรจน์",
  description: "ระบบจัดการร้านแก๊สทอรุ่งโรจน์",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className={inter.className}>
        {/* ส่ง CSS ของ MUI ไปใน head ตอน SSR ไม่แทรกในเนื้อหน้า ซึ่งทำให้ hydration ไม่ตรงกัน */}
        <AppRouterCacheProvider>
          <Header />
          {children}
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
