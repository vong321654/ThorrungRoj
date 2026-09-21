"use client";

import { type FormEvent, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { ADMINROLE } from "@/app/models/admin";
import { errorAlertSx, submitButtonSx, textFieldSx } from "@/app/components/UI/authStyles";

export type AdminFormValues = {
  email: string;
  name: string;
  role: ADMINROLE;
  isActive: boolean;
  password: string;
  confirmPassword: string;
  emailConfirm: boolean;
};

type AdminFormProps = {
  mode: "create" | "edit";
  initialValues?: Partial<AdminFormValues>;
  isSubmitting: boolean;
  message: string | null;
  onSubmit: (values: AdminFormValues) => Promise<void>;
  allowRoleAndStatus?: boolean;
};

export default function AdminForm({
  mode,
  initialValues,
  isSubmitting,
  message,
  onSubmit,
  allowRoleAndStatus = true,
}: AdminFormProps) {
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [name, setName] = useState(initialValues?.name ?? "");
  const [role, setRole] = useState(
    initialValues?.role ?? ADMINROLE.EMPLOYEE,
  );
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailConfirm, setEmailConfirm] = useState(true);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationMessage(null);

    if (mode === "create" && password !== confirmPassword) {
      setValidationMessage("Passwords do not match");
      return;
    }

    await onSubmit({
      email: email.trim(),
      name: name.trim(),
      role,
      isActive,
      password,
      confirmPassword,
      emailConfirm,
    });
  }

  const displayedMessage = validationMessage ?? message;

  return (
    <>
      {displayedMessage && (
        <Alert icon={false} severity="warning" role="alert" sx={errorAlertSx}>
          {displayedMessage}
        </Alert>
      )}

      <Stack component="form" method="post" onSubmit={handleSubmit} spacing={2} sx={{ mt: 3.5 }}>
        <TextField
          id="adminEmail"
          name="email"
          type="email"
          label="Email"
          autoComplete={mode === "create" ? "off" : "email"}
          disabled={mode === "edit"}
          required
          fullWidth
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          sx={textFieldSx}
        />

        <TextField
          id="adminName"
          name="name"
          type="text"
          label="Name"
          fullWidth
          value={name}
          onChange={(event) => setName(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 100 } }}
          sx={textFieldSx}
        />

        <TextField
          id="adminRole"
          name="role"
          label="Role"
          select
          fullWidth
          value={role}
          disabled={!allowRoleAndStatus}
          onChange={(event) => setRole(event.target.value as ADMINROLE)}
          sx={textFieldSx}
        >
          <MenuItem value={ADMINROLE.SUPER_ADMIN}>Super admin</MenuItem>
          <MenuItem value={ADMINROLE.ADMIN}>Admin</MenuItem>
          <MenuItem value={ADMINROLE.EMPLOYEE}>Employee</MenuItem>
        </TextField>

        <FormControlLabel
          control={
            <Checkbox
              checked={isActive}
              disabled={!allowRoleAndStatus}
              onChange={(event) => setIsActive(event.target.checked)}
            />
          }
          label="Active"
        />

        {mode === "create" && (
          <>
            <TextField
              id="adminPassword"
              name="password"
              type="password"
              label="Password"
              autoComplete="new-password"
              required
              fullWidth
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              slotProps={{ htmlInput: { minLength: 6 } }}
              sx={textFieldSx}
            />

            <TextField
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm password"
              autoComplete="new-password"
              required
              fullWidth
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              slotProps={{ htmlInput: { minLength: 6 } }}
              sx={textFieldSx}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={emailConfirm}
                  onChange={(event) => setEmailConfirm(event.target.checked)}
                />
              }
              label="Mark email as confirmed"
            />
          </>
        )}

        <Button type="submit" disabled={isSubmitting} disableElevation fullWidth sx={submitButtonSx}>
          {isSubmitting
            ? mode === "create"
              ? "Creating admin..."
              : "Saving changes..."
            : mode === "create"
              ? "Create admin"
              : "Save changes"}
        </Button>
      </Stack>
    </>
  );
}
