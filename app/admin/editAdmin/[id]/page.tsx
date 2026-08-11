"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminRole, isAdminRole, type AdminData } from "@/app/models/admin";
import AdminForm, {
  type AdminFormValues,
} from "../../components/AdminForm";
import {
  getAdmin,
  getAdminByEmployeeId,
  saveAdminChanges,
} from "../../allFunc";
import styles from "../../../login/Login.module.css";

export default function EditAdminPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAdmin() {
      try {
        const [current, target] = await Promise.all([
          getAdmin(),
          getAdminByEmployeeId(params.id),
        ]);
        setCurrentAdmin(current);
        setAdmin(target);
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
    const canEditRoleAndStatus = currentAdmin?.role === AdminRole.SuperAdmin;
    try {
      const input = {
        id: admin.id,
        name: values.name || null,
        ...(canEditRoleAndStatus
          ? { isActive: values.isActive, role: values.role }
          : {}),
      };
      await saveAdminChanges(input);
      router.replace("/admin");
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
        <Link href="/admin">Back</Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="edit-admin-title">
        <Link className={styles.userLoginLink} href="/admin">
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
          allowRoleAndStatus={currentAdmin?.role === AdminRole.SuperAdmin}
        />
      </section>
    </main>
  );
}
