"use server";

import {
  getCurrentUser,
  getUserByLineUserId,
  updateUser,
} from "@/app/api/services/userService";
import type { UpdateUserPayload, User } from "@/app/models/user";
import { revalidatePath } from "next/cache";
import { validateEditUserPayload } from "./validation";

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

export async function getEditUserData(): Promise<User | null> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return null;
  }

  return getUserByLineUserId(currentUser.lineUserId);
}

export async function saveEditUserData(payload: UpdateUserPayload) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !currentUser.isActive) {
    return { success: false, message: "ไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้" };
  }

  const errors = validateEditUserPayload(payload);
  const firstError = Object.values(errors)[0];
  if (firstError) {
    return { success: false, message: firstError };
  }

  const name = optionalText(payload?.name, 100)!;
  const email = optionalText(payload?.email, 255);
  const phone = optionalText(payload?.phone, 50);
  const address = optionalText(payload?.address, 500);

  try {
    await updateUser(currentUser.id, { name, email, phone, address });
    revalidatePath("/manageUser/editUser");
    revalidatePath("/productPage");
    return { success: true, message: "บันทึกข้อมูลเรียบร้อยแล้ว" };
  } catch {
    return { success: false, message: "ไม่สามารถบันทึกข้อมูลได้" };
  }
}
