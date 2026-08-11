"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAdmin, getAdminsList } from "./allFunc";
import { useAdminSession } from "./AdminSessionContext";
import { useRequireAdmin } from "./useRequireAdmin";
import { AdminRole, type AdminData } from "@/app/models/admin";
import Link from "next/link";
import styles from "./AdminPage.module.css";

export default function AdminPage() {
  const router = useRouter();
  const { admin: adminData, isLoading: isSessionLoading } = useRequireAdmin();
  const { signOut } = useAdminSession();
  const [employeesData, setEmployeesData] = useState<AdminData[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchEmployeesData() {
    try {
      setEmployeesData((await getAdminsList()) || []);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch admin data");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isSessionLoading) return;
    if (adminData?.role === AdminRole.SuperAdmin) {
      void fetchEmployeesData();
    } else {
      setIsLoading(false);
    }
  }, [isSessionLoading, adminData]);

  async function handleSignOut() {
    await signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Deactivate this admin account?")) return;
    try {
      await deleteAdmin(id);
      await fetchEmployeesData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to deactivate admin");
    }
  }

  return (
    <main>
      <h1>Hello {adminData?.role ?? "Admin"}</h1>
      {adminData && <Link href={`/admin/editAdmin/${adminData.id}`}>Edit my account</Link>}
      {isLoading && <p>Loading admin data...</p>}
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {adminData?.role === AdminRole.SuperAdmin &&

        <div >
          <div className={styles.toolbar}>
            <Link className={styles.addButton} href="/admin/addAdmin">
              Add admin
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Avatar URL</th>
                <th>Is Active</th>
                <th>Role</th>
                <th>Updated At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employeesData?.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.email}</td>
                  <td>{emp.name}</td>
                  <td>{emp.avatarUrl}</td>
                  <td>{emp.isActive ? "Yes" : "No"}</td>
                  <td>{emp.role}</td>
                  <td>{emp.updatedAt}</td>
                  <td>
                    <Link href={`/admin/editAdmin/${emp.id}`}>Edit</Link>
                    {adminData && emp.id !== adminData.id && (
                      <button type="button" onClick={() => void handleDelete(emp.id)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }

      <button onClick={handleSignOut}>Sign out</button>
    </main>
  );
}
