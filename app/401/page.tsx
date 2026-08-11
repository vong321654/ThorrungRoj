import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#f7f7f5",
        color: "#202020",
        textAlign: "center",
      }}
    >
      <section>
        <p style={{ margin: 0, fontSize: "5rem", fontWeight: 800 }}>401</p>
        <h1>ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p>กรุณาเข้าสู่ระบบด้วยบัญชีพนักงานหรือผู้ดูแลระบบ</p>
        <Link href="/admin/login">ไปหน้าเข้าสู่ระบบ Admin</Link>
      </section>
    </main>
  );
}
