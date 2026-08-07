"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addAdmin } from "@/app/api/services/adminService";
import { AdminRole } from "@/app/models/admin";
import AdminForm, {
  type AdminFormValues,
} from "../components/AdminForm";
import { getAdmin } from "../adminPage/allFunc";
import styles from "../../login/Login.module.css";

export default function AddAdminPage() {
  const router = useRouter();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function checkAccess() {
      try {
        const admin = await getAdmin();
        if (!isCancelled && admin.role !== AdminRole.SuperAdmin) {
          router.replace("/admin/adminPage");
          return;
        }
      } catch {
        if (!isCancelled) router.replace("/admin/login");
      } finally {
        if (!isCancelled) setIsCheckingAccess(false);
      }
    }

    void checkAccess();
    return () => {
      isCancelled = true;
    };
  }, [router]);

  async function handleSubmit(values: AdminFormValues) {
    setMessage(null);
    setIsSubmitting(true);

    try {
      const result = await addAdmin({
        email: values.email,
        password: values.password,
        email_confirm: values.emailConfirm,
        name: values.name || null,
        role: values.role,
        isActive: values.isActive,
      });

      if (result.status === "error") {
        throw new Error(result.message);
      }

      router.replace("/admin/adminPage");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add admin");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingAccess) {
    return (
      <main className={styles.page}>
        <p>Checking admin access...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="add-admin-title">
        <Link className={styles.userLoginLink} href="/admin/adminPage">
          ← Back to admins
        </Link>

        <header className={styles.heading}>
          <h1 id="add-admin-title">Add admin</h1>
          <p>Create login credentials and an employee profile.</p>
        </header>

        <AdminForm
          mode="create"
          initialValues={{
            role: AdminRole.Employee,
            isActive: true,
          }}
          isSubmitting={isSubmitting}
          message={message}
          onSubmit={handleSubmit}
        />
      </section>
    </main>
  );
}
