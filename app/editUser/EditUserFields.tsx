"use client";

import type { UpdateUserPayload } from "@/app/models/user";
import Link from "next/link";
import { useState } from "react";
import SaveButton from "./SaveButton";
import styles from "./EditUser.module.css";
import { validateEditUserPayload } from "./validation";

type EditUserFieldsProps = {
  initialValues: UpdateUserPayload;
};

export default function EditUserFields({ initialValues }: EditUserFieldsProps) {
  const [values, setValues] = useState(initialValues);
  const errors = validateEditUserPayload(values);
  const hasErrors = Object.keys(errors).length > 0;

  function updateField(field: keyof UpdateUserPayload, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="name">ชื่อผู้ใช้</label>
        <input
          id="name"
          name="name"
          type="text"
          value={values.name || ""}
          onInput={(event) => updateField("name", event.currentTarget.value)}
          placeholder="กรอกชื่อผู้ใช้"
          autoComplete="name"
          maxLength={100}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
          required
        />
        {errors.name && (
          <span className={styles.fieldError} id="name-error">
            {errors.name}
          </span>
        )}
      </div>

      <div className={styles.twoColumns}>
        <div className={styles.field}>
          <label htmlFor="email">อีเมล</label>
          <input
            id="email"
            name="email"
            type="email"
            value={values.email || ""}
            onInput={(event) => updateField("email", event.currentTarget.value)}
            placeholder="name@example.com"
            autoComplete="email"
            maxLength={255}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <span className={styles.fieldError} id="email-error">
              {errors.email}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="phone">เบอร์โทรศัพท์</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={values.phone || ""}
            onInput={(event) => updateField("phone", event.currentTarget.value)}
            placeholder="08X-XXX-XXXX"
            autoComplete="tel"
            inputMode="tel"
            maxLength={20}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          {errors.phone && (
            <span className={styles.fieldError} id="phone-error">
              {errors.phone}
            </span>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="address">ที่อยู่สำหรับจัดส่ง</label>
        <textarea
          id="address"
          name="address"
          value={values.address || ""}
          onInput={(event) => updateField("address", event.currentTarget.value)}
          placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด และรหัสไปรษณีย์"
          autoComplete="street-address"
          rows={5}
          maxLength={500}
          aria-invalid={Boolean(errors.address)}
          aria-describedby={errors.address ? "address-error" : "address-hint"}
        />
        {errors.address ? (
          <span className={styles.fieldError} id="address-error">
            {errors.address}
          </span>
        ) : (
          <span className={styles.hint} id="address-hint">
            กรอกข้อมูลให้ครบเพื่อความถูกต้องในการจัดส่ง
          </span>
        )}
      </div>

      <div className={styles.actions}>
        <Link className={styles.cancelButton} href="/productPage">
          ยกเลิก
        </Link>
        <SaveButton payload={values} hasValidationErrors={hasErrors} />
      </div>
    </div>
  );
}
