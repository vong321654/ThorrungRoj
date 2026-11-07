import type { ReactNode } from "react";
import ThemeRegistry from "@/app/productPage/_shared/ThemeRegistry";

// ใช้ theme เดียวกับหน้าร้าน เพื่อให้ปุ่มและขนาดพื้นที่กดบนอุปกรณ์สัมผัสเหมือนกัน
export default function ManageUserLayout({ children }: { children: ReactNode }) {
  return <ThemeRegistry>{children}</ThemeRegistry>;
}
