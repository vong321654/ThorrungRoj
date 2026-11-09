"use client";

import type { UPDATEUSERPAYLOAD } from "@/app/models/user";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { saveEditUserData } from "./allFunc";

type SaveButtonProps = {
  payload: UPDATEUSERPAYLOAD;
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

    if (result.success) {
      router.push("/productPage");
      return;
    }

    setIsSaving(false);
  }

  return (
    <Box
      sx={{
        alignItems: { xs: "stretch", sm: "center" },
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        gap: 1.25,
      }}
    >
      {message && (
        <Typography sx={{ color: "#166534", fontSize: "0.85rem", fontWeight: 600 }}>
          {message}
        </Typography>
      )}
      <Button
        type="button"
        variant="contained"
        disableElevation
        onClick={handleClick}
        disabled={isSaving || hasValidationErrors}
        sx={{ fontWeight: 700, minHeight: 44 }}
      >
        {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
      </Button>
    </Box>
  );
}
