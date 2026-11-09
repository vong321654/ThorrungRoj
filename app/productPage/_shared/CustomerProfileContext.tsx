"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/models/api";
import type { CURRENTUSER } from "@/app/models/user";
import type { CUSTOMERTYPE } from "@/app/enums/customer";
import { toCustomerType } from "@/app/util/customerPricing";

type CustomerProfileContextValue = {
  // null = ยังไม่เข้าสู่ระบบ, เป็นพนักงาน หรือโหลดไม่สำเร็จ
  profile: CURRENTUSER | null;
  isLoaded: boolean;
  // ประเภทราคาที่ใช้แสดงผล ได้ราคาร้านค้าเฉพาะบัญชีที่แอดมินยืนยันแล้ว (customerType = shop)
  customerType: CUSTOMERTYPE;
  updateProfile: (patch: Partial<CURRENTUSER>) => void;
  reload: () => Promise<void>;
};

const CustomerProfileContext = createContext<CustomerProfileContextValue | null>(null);

export async function getCustomerAccessToken() {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

async function fetchProfile(): Promise<CURRENTUSER | null> {
  const accessToken = await getCustomerAccessToken();
  if (!accessToken) return null;

  const response = await fetch("/api/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const result = (await response.json()) as APIRESULT<CURRENTUSER | null>;
  return result.status === "success" ? result.results : null;
}

/**
 * โหลดโปรไฟล์ลูกค้าครั้งเดียวต่อการเปิดหน้าร้าน ใช้ร่วมกันทั้ง pop-up นโยบาย, pop-up เลือกประเภท และราคาในหน้าร้าน
 */
export function CustomerProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CURRENTUSER | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      setProfile(await fetchProfile());
    } catch {
      // โหลดไม่สำเร็จให้หน้าร้านยังใช้งานได้ด้วยราคาปกติ และจะลองใหม่เมื่อเปิดหน้าครั้งถัดไป
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    fetchProfile()
      .then((nextProfile) => {
        if (!isCancelled) setProfile(nextProfile);
      })
      .catch(() => {})
      .finally(() => {
        if (!isCancelled) setIsLoaded(true);
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  const updateProfile = useCallback((patch: Partial<CURRENTUSER>) => {
    setProfile((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo<CustomerProfileContextValue>(
    () => ({
      profile,
      isLoaded,
      customerType: toCustomerType(profile?.customerType),
      updateProfile,
      reload,
    }),
    [profile, isLoaded, updateProfile, reload],
  );

  return <CustomerProfileContext.Provider value={value}>{children}</CustomerProfileContext.Provider>;
}

export function useCustomerProfile(): CustomerProfileContextValue {
  const context = useContext(CustomerProfileContext);
  if (!context) throw new Error("useCustomerProfile must be used within a CustomerProfileProvider");
  return context;
}
