"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminRole } from "@/app/models/admin";
import AdminForm, {
  type AdminFormValues,
} from "../components/AdminForm";
import { addAdmin } from "../allFunc";
import { useRequireAdmin } from "../useRequireAdmin";
import styles from "../../login/Login.module.css";

export default function AddAdminPage() {
  const router = useRouter();
  const { isAllowed, isLoading: isCheckingAccess } = useRequireAdmin({ role: AdminRole.SuperAdmin });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(values: AdminFormValues) {
    setMessage(null);
    setIsSubmitting(true);

    try {
      await addAdmin({
        email: values.email,
        password: values.password,
        email_confirm: values.emailConfirm,
        name: values.name || null,
        role: values.role,
        isActive: values.isActive,
      });

      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add admin");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingAccess || !isAllowed) {
    return (
      <main className={styles.page}>
        <p>Checking admin access...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="add-admin-title">
        <Link className={styles.userLoginLink} href="/admin">
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
