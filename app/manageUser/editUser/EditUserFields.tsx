"use client";

import type { UPDATEUSERPAYLOAD } from "@/app/models/user";
import Link from "next/link";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import SaveButton from "./SaveButton";
import { validateEditUserPayload } from "./validation";

type EditUserFieldsProps = {
  initialValues: UPDATEUSERPAYLOAD;
};

export default function EditUserFields({ initialValues }: EditUserFieldsProps) {
  const [values, setValues] = useState(initialValues);
  const errors = validateEditUserPayload(values);
  const hasErrors = Object.keys(errors).length > 0;

  function updateField(field: keyof UPDATEUSERPAYLOAD, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <Box sx={{ pt: { xs: 2.5, sm: 3.5 } }}>
      <Grid container spacing={{ xs: 2.5, sm: 3 }}>
        <Grid size={12}>
          <TextField
            id="name"
            name="name"
            label="ชื่อผู้ใช้"
            value={values.name || ""}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="กรอกชื่อผู้ใช้"
            autoComplete="name"
            required
            fullWidth
            error={Boolean(errors.name)}
            helperText={errors.name}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 100 } }}
          />
        </Grid>

        {/* มือถือเรียงทีละแถว แท็บเล็ตขึ้นไปวางคู่กัน */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            id="email"
            name="email"
            type="email"
            label="อีเมล"
            value={values.email || ""}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="name@gmail.com"
            autoComplete="email"
            fullWidth
            error={Boolean(errors.email)}
            helperText={errors.email}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 255 } }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            id="phone"
            name="phone"
            type="tel"
            label="เบอร์โทรศัพท์"
            value={values.phone || ""}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="08X-XXX-XXXX"
            autoComplete="tel"
            fullWidth
            error={Boolean(errors.phone)}
            helperText={errors.phone}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: "tel", maxLength: 20 } }}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            id="address"
            name="address"
            label="ที่อยู่สำหรับจัดส่ง"
            value={values.address || ""}
            onChange={(event) => updateField("address", event.target.value)}
            placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด และรหัสไปรษณีย์"
            autoComplete="street-address"
            multiline
            minRows={5}
            fullWidth
            error={Boolean(errors.address)}
            helperText={errors.address ?? "กรอกข้อมูลให้ครบเพื่อความถูกต้องในการจัดส่ง"}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 500 } }}
          />
        </Grid>
      </Grid>

      <Box
        sx={{
          alignItems: { xs: "stretch", sm: "center" },
          borderTop: "1px solid #e8eee9",
          display: "flex",
          flexDirection: { xs: "column-reverse", sm: "row" },
          gap: 1.5,
          justifyContent: "flex-end",
          mt: 3,
          pt: 3,
        }}
      >
        <Button component={Link} href="/productPage" variant="outlined" color="inherit" sx={{ fontWeight: 700, minHeight: 44 }}>
          ยกเลิก
        </Button>
        <SaveButton payload={values} hasValidationErrors={hasErrors} />
      </Box>
    </Box>
  );
}
