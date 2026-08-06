"use client";

import { useEffect, useState } from "react";
import { getAdmin, signOutAdmin, getAdminsList } from "./allFunc";
import type { AdminData } from "@/app/models/admin";
import Link from "next/link";

export default function AdminPage() {
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [employeesData, setEmployeesData] = useState<AdminData[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setSelectedEmployee] = useState<AdminData | null>(null);
  async function fetchAdminData() {
    try {
      const data = await getAdmin();
        setAdminData(data);
        setErrorMessage(null);
      if (data.role === "superAdmin") {
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
  }

  return (
    <main>
      <h1>Hello {adminData?.role ?? "Admin"}</h1>
      {isLoading && <p>Loading admin data...</p>}
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {adminData?.role == "superAdmin" &&

        <div >
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Avatar URL</th>
                <th>Is Active</th>
                <th>Role</th>
                <th>Updated At</th>
                <th></th>
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
                    <button onClick={() => setSelectedEmployee(emp)}>Delete</button>
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
