"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminRole, isAdminRole, type AdminData } from "@/app/models/admin";
import AdminForm, {
  type AdminFormValues,
} from "../../components/AdminForm";
import {
  getAdminByEmployeeId,
  saveAdminChanges,
} from "../../adminPage/allFunc";
import styles from "../../../login/Login.module.css";

export default function EditAdminPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAdmin() {
      try {
        setAdmin(await getAdminByEmployeeId(params.id));
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load employee data",
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (params.id) void loadAdmin();
  }, [params.id]);

  async function handleSubmit(values: AdminFormValues) {
    if (!admin) return;

    setIsSaving(true);
    setMessage(null);
    try {
      await saveAdminChanges({
        id: admin.id,
        name: values.name || null,
        isActive: values.isActive,
        role: values.role,
      });
      router.replace("/admin/adminPage");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save employee data",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className={styles.page}>
        <p>Loading employee data...</p>
      </main>
    );
  }

  if (!admin) {
    return (
      <main className={styles.page}>
        <p role="alert">{message ?? "Employee not found"}</p>
        <Link href="/admin/adminPage">Back</Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="edit-admin-title">
        <Link className={styles.userLoginLink} href="/admin/adminPage">
          ← Back to admins
        </Link>

        <header className={styles.heading}>
          <h1 id="edit-admin-title">Edit employee</h1>
          <p>Update this employee&apos;s profile, role, and status.</p>
        </header>

        <AdminForm
          mode="edit"
          initialValues={{
            email: admin.email ?? "",
            name: admin.name ?? "",
            role: isAdminRole(admin.role) ? admin.role : AdminRole.Employee,
            isActive: admin.isActive,
          }}
          isSubmitting={isSaving}
          message={message}
          onSubmit={handleSubmit}
        />
      </section>
    </main>
  );
}
