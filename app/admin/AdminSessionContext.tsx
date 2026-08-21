"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getAdmin, signOutAdmin } from "./allFunc";
import type { ADMINDATA } from "@/app/models/admin";

const SESSION_STORAGE_KEY = "thor-rungroj-admin-session";

type AdminSessionContextValue = {
  admin: ADMINDATA | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<ADMINDATA | null>;
  signOut: () => Promise<void>;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

function writeCache(admin: ADMINDATA | null) {
  if (typeof window === "undefined") return;
  try {
    if (admin) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(admin));
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // sessionStorage unavailable (private browsing, etc.) - just skip caching
  }
}

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  // Keep the first client render identical to the server render. Reading
  // sessionStorage here would render cached admin-only UI before hydration.
  const [admin, setAdmin] = useState<ADMINDATA | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAdmin();
      setAdmin(data);
      writeCache(data);
      return data;
    } catch (err) {
      setAdmin(null);
      writeCache(null);
      setError(err instanceof Error ? err.message : "Failed to load admin session");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await signOutAdmin();
    setAdmin(null);
    writeCache(null);
  }, []);

  const value = useMemo(
    () => ({ admin, isLoading, error, refresh, signOut }),
    [admin, isLoading, error, refresh, signOut],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error("useAdminSession must be used within AdminSessionProvider");
  return ctx;
}
