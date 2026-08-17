"use client";

import { type FormEvent, useState } from "react";
import { AdminRole } from "@/app/models/admin";
import styles from "../../login/Login.module.css";

export type AdminFormValues = {
  email: string;
  name: string;
  role: AdminRole;
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
    initialValues?.role ?? AdminRole.Employee,
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
        <p className={styles.message} role="alert">
          {displayedMessage}
        </p>
      )}

      <form className={styles.emailForm} method="post" onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete={mode === "create" ? "off" : "email"}
            disabled={mode === "edit"}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="admin-name">Name</label>
          <input
            id="admin-name"
            name="name"
            type="text"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="admin-role">Role</label>
          <select
            id="admin-role"
            name="role"
            value={role}
            disabled={!allowRoleAndStatus}
            onChange={(event) => setRole(event.target.value as AdminRole)}
          >
            <option value={AdminRole.SuperAdmin}>Super admin</option>
            <option value={AdminRole.Admin}>Admin</option>
            <option value={AdminRole.Employee}>Employee</option>
          </select>
        </div>

        <label>
          <input
            type="checkbox"
            checked={isActive}
            disabled={!allowRoleAndStatus}
            onChange={(event) => setIsActive(event.target.checked)}
          />{" "}
          Active
        </label>

        {mode === "create" && (
          <>
            <div className={styles.field}>
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>

            <label>
              <input
                type="checkbox"
                checked={emailConfirm}
                onChange={(event) => setEmailConfirm(event.target.checked)}
              />{" "}
              Mark email as confirmed
            </label>
          </>
        )}

        <button
          className={styles.submitButton}
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? mode === "create"
              ? "Creating admin..."
              : "Saving changes..."
            : mode === "create"
              ? "Create admin"
              : "Save changes"}
        </button>
      </form>
    </>
  );
}
