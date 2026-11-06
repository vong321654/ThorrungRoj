"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { ADMINROLE, ISADMINROLE, type ADMINDATA } from "@/app/models/admin";
import AdminForm, {
  type AdminFormValues,
} from "../../components/AdminForm";
import { getAdminByEmployeeId, saveAdminChanges } from "../../allFunc";
import { useAdminSession } from "../../AdminSessionContext";
import { useRequireAdmin } from "../../useRequireAdmin";
import {
  adminPageSx,
  authCardSx,
  backLinkSx,
  headingSubtitleSx,
  headingTitleSx,
} from "@/app/components/UI/authStyles";

export default function EditAdminPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { admin: currentAdmin, isLoading: isSessionLoading } = useRequireAdmin();
  const { refresh: refreshSession } = useAdminSession();
  const [admin, setAdmin] = useState<ADMINDATA | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isSessionLoading || !currentAdmin) return;

    async function loadTarget() {
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

    if (params.id) void loadTarget();
  }, [params.id, isSessionLoading, currentAdmin]);

  async function handleSubmit(values: AdminFormValues) {
    if (!admin) return;

    setIsSaving(true);
    setMessage(null);
    const canEditRoleAndStatus = currentAdmin?.role === ADMINROLE.SUPER_ADMIN;
    try {
      const input = {
        id: admin.id,
        name: values.name || null,
        address: values.address || null,
        tel: values.tel || null,
        thaiId: values.thaiId || null,
        ...(canEditRoleAndStatus
          ? { isActive: values.isActive, role: values.role }
          : {}),
      };
      await saveAdminChanges(input);
      // แก้บัญชีตัวเองแล้วต้องโหลด session ใหม่ ไม่งั้นชื่อใน sidebar ยังเป็นค่าเดิม
      if (admin.id === currentAdmin?.id) await refreshSession();
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
      <Box component="main" sx={adminPageSx}>
        <Typography>Loading employee data...</Typography>
      </Box>
    );
  }

  if (!admin) {
    return (
      <Box component="main" sx={{ ...adminPageSx, flexDirection: "column", gap: 1.5 }}>
        <Typography role="alert">{message ?? "Employee not found"}</Typography>
        <MuiLink component={Link} href="/admin" sx={backLinkSx}>
          Back
        </MuiLink>
      </Box>
    );
  }

  return (
    <Box component="main" sx={adminPageSx}>
      <Paper component="section" aria-labelledby="editAdminTitle" elevation={0} sx={authCardSx}>
        <MuiLink component={Link} href="/admin" sx={backLinkSx}>
          ← Back to admins
        </MuiLink>

        <Box>
          <Typography id="editAdminTitle" component="h1" sx={headingTitleSx}>
            Edit employee
          </Typography>
          <Typography sx={headingSubtitleSx}>
            Update this employee&apos;s profile, role, and status.
          </Typography>
        </Box>

        <AdminForm
          mode="edit"
          initialValues={{
            email: admin.email ?? "",
            name: admin.name ?? "",
            address: admin.address ?? "",
            tel: admin.tel ?? "",
            thaiId: admin.thaiId ?? "",
            role: ISADMINROLE(admin.role) ? admin.role : ADMINROLE.EMPLOYEE,
            isActive: admin.isActive,
          }}
          isSubmitting={isSaving}
          message={message}
          onSubmit={handleSubmit}
          allowRoleAndStatus={currentAdmin?.role === ADMINROLE.SUPER_ADMIN}
        />
      </Paper>
    </Box>
  );
}
