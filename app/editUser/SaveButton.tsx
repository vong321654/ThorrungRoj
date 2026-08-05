"use client";

import type { UpdateUserPayload } from "@/app/models/user";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveEditUserData } from "./allFunc";
import styles from "./EditUser.module.css";

type SaveButtonProps = {
  payload: UpdateUserPayload;
  hasValidationErrors: boolean;
};

export default function SaveButton({
  payload,
  hasValidationErrors,
}: SaveButtonProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setIsSaving(true);
    setMessage(null);

    const result = await saveEditUserData(payload);
    setMessage(result.message);
    setIsSaving(false);

    if (result.success) {
      router.refresh();
    }
  }

  return (
    <div className={styles.saveArea}>
      {message && <span className={styles.saveMessage}>{message}</span>}
      <button
        className={styles.saveButton}
        type="button"
        onClick={handleClick}
        disabled={isSaving || hasValidationErrors}
      >
        {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
      </button>
    </div>
  );
}
