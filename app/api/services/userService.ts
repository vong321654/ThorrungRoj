import { createAdminClient } from "@/app/api/util/supabase/admin";
import { createAuthenticatedClient } from "@/app/api/util/supabase/authenticated";
import {
  CURRENTUSER_FIELDS,
  type CURRENTUSER,
  type LINEPROFILE,
  type USER,
  type USERID,
  type UPDATEUSERPAYLOAD,
} from "@/app/models/user";
import { CUSTOMERTYPE, SHOPREQUESTSTATUS } from "@/app/enums/customer";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient } from "@/app/api/util/supabase/server";
import { apiError, apiSuccess } from "../response";
import type { APIRESULT } from "@/app/models/api";

export async function getUserById(
  userId: USERID,
): Promise<APIRESULT<CURRENTUSER | null>> {
  const cookieStore = await cookies();
  const { data, error } = await createClient(cookieStore)
    .from("users")
    .select(CURRENTUSER_FIELDS)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return apiError("Failed to fetch user");
  }
  return apiSuccess(
    data ? "User retrieved successfully" : "User not found",
    data,
  );
}

export async function getUserByLineUserId(
  lineUserId: string,
): Promise<APIRESULT<USER | null>> {
  const cookieStore = await cookies();
  const { data, error } = await createClient(cookieStore)
    .from("users")
    .select("*")
    .eq("lineUserId", lineUserId)
    .maybeSingle();

  if (error) {
    return apiError("Failed to fetch user");
  }

  return apiSuccess(
    data ? "User retrieved successfully" : "User not found",
    data,
  );
}

export async function createUserFromLineProfile(
  profile: LINEPROFILE,
): Promise<APIRESULT<USER>> {
  // Legacy sync helper: it runs only on the server during LINE account setup.
  const { data, error } = await createAdminClient()
    .from("users")
    .insert({
      lineUserId: profile.userId,
      name: profile.displayName?.trim() || null,
      avatarUrl: profile.pictureUrl || null,
      email: null,
      isActive: true,
    })
    .select()
    .single();

  if (error) {
    return apiError("Failed to create user");
  }

  return apiSuccess("User created successfully", data);
}

export async function findOrCreateUserFromLineProfile(
  profile: LINEPROFILE,
): Promise<APIRESULT<USER>> {
  const existingUserResult = await getUserByLineUserId(profile.userId);
  if (existingUserResult.status === "error") return existingUserResult;
  if (existingUserResult.results) {
    return apiSuccess("User retrieved successfully", existingUserResult.results);
  }

  return createUserFromLineProfile(profile);
}

function getStringMetadata(
  metadata: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function syncUserFromSupabaseLineAuth(
  authUser: SupabaseAuthUser,
): Promise<APIRESULT<USER>> {
  const lineIdentity = authUser.identities?.find(
    (identity) => identity.provider === "custom:line-liff",
  ) ?? authUser.identities?.[0];
  const metadata = {
    ...authUser.user_metadata,
    ...(lineIdentity?.identity_data ?? {}),
  } as Record<string, unknown>;

  const lineUserId = getStringMetadata(metadata, [
    "sub",
    "userId",
    "user_id",
    "provider_id",
  ]);
  if (!lineUserId) return apiError("LINE user id is missing from Supabase Auth");

  const displayName = getStringMetadata(metadata, [
    "name",
    "displayName",
    "full_name",
  ]);
  const avatarUrl = getStringMetadata(metadata, [
    "picture",
    "pictureUrl",
    "avatar_url",
  ]);

  // OAuth callback runs on the server while the customer record may not yet
  // exist, so this narrowly scoped provisioning operation remains privileged.
  const supabase = createAdminClient();

  // ลูกค้าใหม่เท่านั้นที่รับชื่อจาก LINE และเริ่มต้นเป็น active
  // ลูกค้าเดิมต้องไม่ถูกเขียนทับ ไม่งั้นชื่อที่แก้เองจะหายและบัญชีที่ร้านปิดจะกลับมาใช้ได้ (PDPA มาตรา 35, 36)
  const { error: insertError } = await supabase.from("users").upsert(
    {
      authId: authUser.id,
      lineUserId,
      name: displayName ?? "LINE User",
      lineDisplayName: displayName,
      avatarUrl,
    },
    { onConflict: "lineUserId", ignoreDuplicates: true },
  );
  if (insertError) return apiError("Failed to sync LINE user");

  const { data, error } = await supabase
    .from("users")
    .update({
      authId: authUser.id,
      ...(displayName ? { lineDisplayName: displayName } : {}),
      updatedAt: new Date().toISOString(),
    })
    .eq("lineUserId", lineUserId)
    .select("*")
    .single();
  if (error) return apiError("Failed to sync LINE user");

  // avatarUrl เป็น null หมายถึงลูกค้าไม่มีรูปหรือคัดค้านการใช้รูปแล้ว จึงอัปเดตเฉพาะรูปที่มีอยู่ (PDPA มาตรา 32)
  if (avatarUrl && data.avatarUrl && avatarUrl !== data.avatarUrl) {
    const { data: updated, error: avatarError } = await supabase
      .from("users")
      .update({ avatarUrl })
      .eq("id", data.id)
      .select("*")
      .single();
    if (avatarError) return apiError("Failed to sync LINE user");
    return apiSuccess("LINE user synchronized successfully", updated);
  }

  return apiSuccess("LINE user synchronized successfully", data);
}

export async function getCurrentUser(
  accessToken?: string,
): Promise<APIRESULT<CURRENTUSER | null>> {
  let authUser: SupabaseAuthUser | null = null;
  let authError: unknown = null;

  if (accessToken) {
    const result = await createAuthenticatedClient(accessToken).auth.getUser(accessToken);
    authUser = result.data.user;
    authError = result.error;
  } else {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const result = await supabase.auth.getUser();
    authUser = result.data.user;
    authError = result.error;
  }

  if (authError || !authUser) return apiSuccess("No current user", null);

  const profileClient = accessToken
    ? createAuthenticatedClient(accessToken)
    : createClient(await cookies());
  const { data, error } = await profileClient
    .from("users")
    .select(CURRENTUSER_FIELDS)
    .eq("authId", authUser.id)
    .maybeSingle();

  if (error) return apiError("Failed to fetch current user");
  return apiSuccess(data ? "User retrieved successfully" : "User not found", data);
}

export async function acknowledgePrivacyPolicy(
  accessToken: string,
  version: string,
): Promise<{ result: APIRESULT<null>; status: number }> {
  const { data: authData, error: authError } = await createAuthenticatedClient(accessToken)
    .auth.getUser(accessToken);
  if (authError || !authData.user) {
    return { result: apiError("Invalid session"), status: 401 };
  }

  // เขียนด้วย service role เพราะลูกค้าแก้คอลัมน์หลักฐานนี้เองไม่ได้ เวลาจึงมาจากเซิร์ฟเวอร์เท่านั้น
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("users")
    .update({ privacyPolicyVersion: version, privacyAcknowledgedAt: now, updatedAt: now })
    .eq("authId", authData.user.id)
    .select("id")
    .maybeSingle();

  if (error) return { result: apiError("Failed to save acknowledgement"), status: 500 };
  if (!data) return { result: apiError("Customer profile was not found"), status: 404 };
  return { result: apiSuccess("Privacy policy acknowledged", null), status: 200 };
}

const MAX_SHOP_NAME_LENGTH = 100;

/**
 * ลูกค้าเลือกประเภทได้ครั้งเดียวหลังรับทราบนโยบาย เปลี่ยนภายหลังได้เฉพาะแอดมิน
 * เลือกร้านค้าจะยังได้ราคาบ้านทั่วไปจนกว่าแอดมินจะกดยืนยันคำขอ
 */
export async function chooseCustomerType(
  accessToken: string,
  payload: unknown,
): Promise<{ result: APIRESULT<CURRENTUSER | null>; status: number }> {
  const body = payload && typeof payload === "object"
    ? (payload as { customerType?: unknown; shopName?: unknown })
    : null;
  if (body?.customerType !== CUSTOMERTYPE.INDIVIDUAL && body?.customerType !== CUSTOMERTYPE.SHOP) {
    return { result: apiError("Invalid customer type"), status: 400 };
  }
  const isShop = body.customerType === CUSTOMERTYPE.SHOP;
  const shopName = typeof body.shopName === "string" ? body.shopName.trim() : "";
  if (isShop && (!shopName || shopName.length > MAX_SHOP_NAME_LENGTH)) {
    return { result: apiError("กรุณาระบุชื่อร้าน (ไม่เกิน 100 ตัวอักษร)"), status: 400 };
  }

  const { data: authData, error: authError } = await createAuthenticatedClient(accessToken)
    .auth.getUser(accessToken);
  if (authError || !authData.user) {
    return { result: apiError("Invalid session"), status: 401 };
  }

  // เขียนด้วย service role เพราะ trigger กันลูกค้าแก้คอลัมน์ประเภทเอง เงื่อนไขทั้งหมดจึงต้องตรวจที่นี่
  const supabase = createAdminClient();
  const { data: current, error: currentError } = await supabase
    .from("users")
    .select("id, isActive, privacyAcknowledgedAt, customerType, customerTypeChosenAt")
    .eq("authId", authData.user.id)
    .maybeSingle();
  if (currentError) return { result: apiError("Failed to load customer profile"), status: 500 };
  if (!current) return { result: apiError("Customer profile was not found"), status: 404 };
  if (!current.isActive) return { result: apiError("Customer account is inactive"), status: 403 };
  if (!current.privacyAcknowledgedAt) {
    return { result: apiError("กรุณารับทราบนโยบายความเป็นส่วนตัวก่อน"), status: 409 };
  }
  if (current.customerTypeChosenAt) {
    return { result: apiError("เลือกประเภทลูกค้าไปแล้ว หากต้องการเปลี่ยนกรุณาติดต่อร้าน"), status: 409 };
  }

  const now = new Date().toISOString();
  // แอดมินตั้งเป็นร้านค้าไว้แล้ว (ก่อนมีฟีเจอร์นี้หรือแก้ในหน้า admin/users) ต้องไม่ถูกลดเป็นบ้านทั่วไป
  const isAlreadyShop = current.customerType === CUSTOMERTYPE.SHOP;
  // กรองด้วย customerTypeChosenAt is null อีกชั้น กันกดซ้ำพร้อมกันจากสองหน้าจอ
  const { data, error } = await supabase
    .from("users")
    .update(isAlreadyShop
      ? { customerTypeChosenAt: now, shopRequestStatus: SHOPREQUESTSTATUS.APPROVED, updatedAt: now }
      : {
        customerType: CUSTOMERTYPE.INDIVIDUAL,
        customerTypeChosenAt: now,
        shopRequestStatus: isShop ? SHOPREQUESTSTATUS.PENDING : null,
        ...(isShop ? { shopName } : {}),
        updatedAt: now,
      })
    .eq("id", current.id)
    .is("customerTypeChosenAt", null)
    .select(CURRENTUSER_FIELDS)
    .maybeSingle();

  if (error) return { result: apiError("Failed to save customer type"), status: 500 };
  if (!data) {
    return { result: apiError("เลือกประเภทลูกค้าไปแล้ว หากต้องการเปลี่ยนกรุณาติดต่อร้าน"), status: 409 };
  }
  return { result: apiSuccess("Customer type saved", data as CURRENTUSER), status: 200 };
}

export async function updateUser(
  userId: USERID,
  payload: UPDATEUSERPAYLOAD,
): Promise<APIRESULT<USER>> {
  const supabase = createClient(await cookies());
  const { data: user, error } = await supabase
    .from("users")
    .update({
      ...payload,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    return apiError("Failed to update user");
  }

  return apiSuccess("User updated successfully", user);
}
