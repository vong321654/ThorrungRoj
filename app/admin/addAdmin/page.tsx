"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { ADMINROLE } from "@/app/models/admin";
import AdminForm, {
  type AdminFormValues,
} from "../components/AdminForm";
import { addAdmin } from "../allFunc";
import { useRequireAdmin } from "../useRequireAdmin";
import {
  authCardSx,
  authPageSx,
  backLinkSx,
  headingSubtitleSx,
  headingTitleSx,
} from "@/app/components/UI/authStyles";

export default function AddAdminPage() {
  const router = useRouter();
  const { isAllowed, isLoading: isCheckingAccess } = useRequireAdmin({ role: ADMINROLE.SUPER_ADMIN });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(values: AdminFormValues) {
    setMessage(null);
    setIsSubmitting(true);

    try {
      await addAdmin({
        email: values.email,
        password: values.password,
        email_confirm: values.emailConfirm,
        name: values.name || null,
        role: values.role,
        isActive: values.isActive,
      });

      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add admin");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingAccess || !isAllowed) {
    return (
      <Box component="main" sx={authPageSx}>
        <Typography>Checking admin access...</Typography>
      </Box>
    );
  }

  return (
    <Box component="main" sx={authPageSx}>
      <Paper component="section" aria-labelledby="addAdminTitle" elevation={0} sx={authCardSx}>
        <MuiLink component={Link} href="/admin" sx={backLinkSx}>
          ← Back to admins
        </MuiLink>

        <Box>
          <Typography id="addAdminTitle" component="h1" sx={headingTitleSx}>
            Add admin
          </Typography>
          <Typography sx={headingSubtitleSx}>
            Create login credentials and an employee profile.
          </Typography>
        </Box>

        <AdminForm
          mode="create"
          initialValues={{
            role: ADMINROLE.EMPLOYEE,
            isActive: true,
          }}
          isSubmitting={isSubmitting}
          message={message}
          onSubmit={handleSubmit}
        />
      </Paper>
    </Box>
  );
}
