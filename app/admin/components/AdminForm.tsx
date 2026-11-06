"use client";

import { type FormEvent, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { ADMINROLE, ISTHAIID, VALIDATEADMINCONTACT } from "@/app/models/admin";
import { errorAlertSx, submitButtonSx, textFieldSx } from "@/app/components/UI/authStyles";

export type AdminFormValues = {
  email: string;
  name: string;
  address: string;
  tel: string;
  thaiId: string;
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
  const [address, setAddress] = useState(initialValues?.address ?? "");
  const [tel, setTel] = useState(initialValues?.tel ?? "");
  // บัตรประชาชนกับวีซ่าใช้คอลัมน์เดียวกัน จึงแยกค่าเดิมกลับเข้าช่องที่ถูกต้องตอนเปิดฟอร์ม
  const initialIdNumber = initialValues?.thaiId ?? "";
  const [thaiId, setThaiId] = useState(ISTHAIID(initialIdNumber) ? initialIdNumber : "");
  const [visa, setVisa] = useState(ISTHAIID(initialIdNumber) ? "" : initialIdNumber);
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

    if (thaiId.trim() && !ISTHAIID(thaiId.trim())) {
      setValidationMessage("Thai ID must be exactly 13 digits");
      return;
    }

    const contact = {
      address: address.trim(),
      tel: tel.trim(),
      thaiId: (thaiId.trim() || visa.trim()).toUpperCase(),
    };
    const contactError = VALIDATEADMINCONTACT(contact);
    if (contactError) {
      setValidationMessage(contactError);
      return;
    }

    await onSubmit({
      email: email.trim(),
      name: name.trim(),
      ...contact,
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
          id="adminTel"
          name="tel"
          type="tel"
          label="Phone number"
          placeholder="08X-XXX-XXXX"
          autoComplete="off"
          fullWidth
          value={tel}
          onChange={(event) => setTel(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 20, inputMode: "tel" } }}
          sx={textFieldSx}
        />

        <TextField
          id="adminThaiId"
          name="thaiId"
          type="text"
          label="Thai ID"
          placeholder="13 digits, no dashes"
          autoComplete="off"
          fullWidth
          disabled={Boolean(visa.trim())}
          helperText={visa.trim() ? "Clear Visa / Passport no. to enter a Thai ID" : undefined}
          value={thaiId}
          onChange={(event) => setThaiId(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 13, inputMode: "numeric" } }}
          sx={textFieldSx}
        />

        <TextField
          id="adminVisa"
          name="visa"
          type="text"
          label="Visa / Passport no."
          placeholder="No dashes or spaces"
          autoComplete="off"
          fullWidth
          disabled={Boolean(thaiId.trim())}
          helperText={thaiId.trim() ? "Clear Thai ID to enter a visa or passport number" : undefined}
          value={visa}
          onChange={(event) => setVisa(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 20 } }}
          sx={textFieldSx}
        />

        <TextField
          id="adminAddress"
          name="address"
          label="Address"
          autoComplete="off"
          fullWidth
          multiline
          minRows={3}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 500 } }}
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
