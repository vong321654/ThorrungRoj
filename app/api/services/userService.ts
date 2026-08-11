import { createAdminClient } from "@/app/api/util/supabase/admin";
import type {
  CurrentUser,
  LineProfile,
  User,
  UserId,
  UpdateUserPayload,
} from "@/app/models/user";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient } from "@/app/api/util/supabase/server";
import { apiError, apiSuccess, type ApiResult } from "../response";

export async function getUserById(
  userId: UserId,
): Promise<ApiResult<CurrentUser | null>> {
  const { data, error } = await createAdminClient()
    .from("users")
    .select("id, lineUserId, name, avatarUrl, isActive")
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
): Promise<ApiResult<User | null>> {
  const { data, error } = await createAdminClient()
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
  profile: LineProfile,
): Promise<ApiResult<User>> {
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
  profile: LineProfile,
): Promise<ApiResult<User>> {
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
): Promise<ApiResult<User>> {
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

  const { data, error } = await createAdminClient()
    .from("users")
    .upsert(
      {
        authId: authUser.id,
        lineUserId,
        name: displayName ?? "LINE User",
        lineDisplayName: displayName,
        avatarUrl,
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
      { onConflict: "lineUserId" },
    )
    .select("*")
    .single();

  if (error) return apiError("Failed to sync LINE user");
  return apiSuccess("LINE user synchronized successfully", data);
}

export async function getCurrentUser(
  accessToken?: string,
): Promise<ApiResult<CurrentUser | null>> {
  let authUser: SupabaseAuthUser | null = null;
  let authError: unknown = null;

  if (accessToken) {
    const result = await createAdminClient().auth.getUser(accessToken);
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

  const { data, error } = await createAdminClient()
    .from("users")
    .select("id, lineUserId, name, avatarUrl, isActive")
    .eq("authId", authUser.id)
    .maybeSingle();

  if (error) return apiError("Failed to fetch current user");
  return apiSuccess(data ? "User retrieved successfully" : "User not found", data);
}
export async function updateUser(
  userId: UserId,
  payload: UpdateUserPayload,
): Promise<ApiResult<User>> {
  const { data: user, error } = await createAdminClient()
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
