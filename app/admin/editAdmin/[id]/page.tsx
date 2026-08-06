"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AdminData } from "@/app/models/admin";
import { getAdminByEmployeeId, saveAdminChanges } from "../../adminPage/allFunc";

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
        setMessage(error instanceof Error ? error.message : "Unable to load employee data");
      } finally {
        setIsLoading(false);
      }
    }

    if (params.id) loadAdmin();
  }, [params.id]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!admin) return;

    setIsSaving(true);
    setMessage(null);
    try {
      await saveAdminChanges({
        id: admin.id,
        name: admin.name?.trim() || null,
        isActive: admin.isActive,
        role: admin.role?.trim() || null,
      });
      router.push("/admin/adminPage");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save employee data");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <main><p>Loading employee data...</p></main>;
  if (!admin) return <main><p role="alert">{message ?? "Employee not found"}</p><Link href="/admin/adminPage">Back</Link></main>;

  return (
    <main>
      <Link href="/admin/adminPage">← Back to employees</Link>
      <h1>Edit employee</h1>
      <p>{admin.email ?? "No email"}</p>
      <form onSubmit={handleSubmit}>
        <p>
          <label htmlFor="name">Name</label><br />
          <input id="name" value={admin.name ?? ""} onChange={(event) => setAdmin({ ...admin, name: event.target.value })} maxLength={100} />
        </p>
        <p>
          <label htmlFor="role">Role</label><br />
          <input id="role" value={admin.role ?? ""} onChange={(event) => setAdmin({ ...admin, role: event.target.value })} maxLength={50} />
        </p>
        <p>
          <label>
            <input type="checkbox" checked={admin.isActive} onChange={(event) => setAdmin({ ...admin, isActive: event.target.checked })} /> Active
          </label>
        </p>
        {message && <p role="alert">{message}</p>}
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save changes"}</button>
      </form>
    </main>
  );
}
