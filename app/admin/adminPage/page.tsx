"use client";

import { useEffect } from "react";
import { getAdmin } from "./allFunc";

export default function AdminPage() {
  useEffect(() => {
    void getAdmin().then((admin) => {
      console.log("CURRENT ADMIN:", admin);
    });
  }, []);

  return <h1>Admin Page</h1>;
}
