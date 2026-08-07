import { createAdminClient } from "@/app/api/util/supabase/admin";
import type {
  CurrentUser,
  LineProfile,
  User,
  UserId,
  UserSessionPayload,
  UpdateUserPayload,
} from "@/app/models/user";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
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

export async function getCurrentUser(): Promise<ApiResult<CurrentUser | null>> {
  const token = (await cookies()).get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token || !jwtSecret) return apiSuccess("No current user", null);

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload === "string" || !("userId" in payload)) {
      return apiSuccess("No current user", null);
    }

    const userId = (payload as UserSessionPayload).userId;
    if (userId === undefined) return apiSuccess("No current user", null);
    return getUserById(userId);
  } catch {
    return apiSuccess("No current user", null);
  }
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
