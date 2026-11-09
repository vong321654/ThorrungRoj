import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Supabase ส่งกลับมาที่ Site URL (/?code=...) เมื่อ redirectTo ไม่อยู่ใน allowlist
// ส่งต่อไป callback ฝั่งเซิร์ฟเวอร์ก่อนที่ JS ในเบราว์เซอร์จะทำงาน ไม่งั้น code หายระหว่างทาง
// และ callback ไม่ได้ซิงก์ผู้ใช้หรือพากลับหน้าเดิม
export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const forwarded = new URLSearchParams();
  for (const key of ["code", "error", "error_description"]) {
    const value = params[key];
    if (typeof value === "string") forwarded.set(key, value);
  }

  if (forwarded.has("code") || forwarded.has("error")) {
    redirect(`/api/auth/line?${forwarded.toString()}`);
  }

  redirect("/login");
}
