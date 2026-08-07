"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdmin, signOutAdmin, getAdminsList } from "./allFunc";
import { AdminRole, type AdminData } from "@/app/models/admin";
import Link from "next/link";
import styles from "./AdminPage.module.css";

export default function AdminPage() {
  const router = useRouter();
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [employeesData, setEmployeesData] = useState<AdminData[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  async function fetchAdminData() {
    try {
      const data = await getAdmin();
        setAdminData(data);
        setErrorMessage(null);
      if (data.role === AdminRole.SuperAdmin) {
        setEmployeesData((await getAdminsList()) || []);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch admin data");
      setAdminData(null);
    } finally {
      setIsLoading(false);
    }
  }
  useEffect(() => {
    void fetchAdminData();
  }, []);
  async function handleSignOut() {
    await signOutAdmin();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <main>
      <h1>Hello {adminData?.role ?? "Admin"}</h1>
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
