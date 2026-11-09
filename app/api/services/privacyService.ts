import "server-only";

import { apiError, apiSuccess } from "@/app/api/response";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import type { SERVICERESULT } from "@/app/models/api";
import { RECEIPT_IMAGE_BUCKET, storagePathFromUrl } from "./imageService";

const SLIP_BATCH_SIZE = 500;

const ERASE_RESULTS: Record<string, SERVICERESULT<null>> = {
  erased: { result: apiSuccess("Customer data erased", null), status: 200 },
  alreadyErased: { result: apiSuccess("Customer data was already erased", null), status: 200 },
  notFound: { result: apiError("ไม่พบลูกค้า"), status: 404 },
  hasOpenItems: {
    result: apiError("ลบไม่ได้ เพราะลูกค้ายังมีคำสั่งซื้อที่ยังไม่จบ ยอดค้างชำระ หรือถังค้างคืน"),
    status: 409,
  },
};

/** ใช้สิทธิลบข้อมูลตามมาตรา 33 เอกสารการซื้อขายยังอยู่จนพ้นกำหนดเก็บ แต่ไม่ผูกกับตัวลูกค้าแล้ว */
export async function eraseCustomerData(userId: string): Promise<SERVICERESULT<null>> {
  const { data, error } = await createAdminClient().rpc("eraseCustomerData", { pUserId: userId });
  if (error) return { result: apiError("Failed to erase customer data"), status: 500 };
  return ERASE_RESULTS[data as string] ?? { result: apiError("Failed to erase customer data"), status: 500 };
}

/** ลบข้อมูลที่พ้นกำหนดเก็บตามข้อ 5 ของนโยบาย (มาตรา 37 (3)) ถูกเรียกวันละครั้งจาก scheduler */
export async function runPrivacyRetention(): Promise<SERVICERESULT<Record<string, number>>> {
  const supabase = createAdminClient();

  const { data: slips, error: slipError } = await supabase.rpc("listExpiredTransferSlips", {
    pLimit: SLIP_BATCH_SIZE,
  });
  if (slipError) return { result: apiError("Failed to list expired slips"), status: 500 };

  const expiredSlips = (slips ?? []) as Array<{ id: string; slipImageUrl: string }>;
  if (expiredSlips.length > 0) {
    // ลบไฟล์ก่อนลบแถว ถ้าล้มเหลวกลางทางแถวยังอยู่ รอบถัดไปจึงลองลบไฟล์ซ้ำได้
    const paths = expiredSlips.map(
      ({ slipImageUrl }) => storagePathFromUrl(slipImageUrl, RECEIPT_IMAGE_BUCKET) ?? slipImageUrl,
    );
    const { error: storageError } = await supabase.storage.from(RECEIPT_IMAGE_BUCKET).remove(paths);
    if (storageError) return { result: apiError("Failed to remove expired slip images"), status: 500 };

    const { error: deleteError } = await supabase
      .from("transferSlips")
      .delete()
      .in("id", expiredSlips.map(({ id }) => id));
    if (deleteError) return { result: apiError("Failed to delete expired slips"), status: 500 };
  }

  const { data, error } = await supabase.rpc("runPrivacyRetention");
  if (error) return { result: apiError("Failed to run privacy retention"), status: 500 };

  return {
    result: apiSuccess("Privacy retention completed", {
      ...(data as Record<string, number>),
      slips: expiredSlips.length,
    }),
    status: 200,
  };
}
