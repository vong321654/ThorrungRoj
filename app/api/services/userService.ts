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

export async function getUserById(userId: UserId): Promise<CurrentUser | null> {
  const { data, error } = await createAdminClient()
    .from("users")
    .select("id, lineUserId, name, avatarUrl, isActive")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("GET USER BY ID ERROR:", error.message);
    throw new Error("Failed to fetch user");
  }
  console.log("GET USER BY ID DATA:", data);
  return data;
}

export async function getUserByLineUserId(
  lineUserId: string,
): Promise<User | null> {
  const { data, error } = await createAdminClient()
    .from("users")
    .select("*")
    .eq("lineUserId", lineUserId)
    .maybeSingle();

  if (error) {
    console.error("GET USER BY LINE ID ERROR:", error.message);
    throw new Error("Failed to fetch user");
  }

  return data;
}

export async function createUserFromLineProfile(
  profile: LineProfile,
): Promise<User> {
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
    console.error("CREATE USER ERROR:", error.message);
    throw new Error("Failed to create user");
  }

  return data;
}

export async function findOrCreateUserFromLineProfile(
  profile: LineProfile,
): Promise<User> {
  const existingUser = await getUserByLineUserId(profile.userId);
  return existingUser ?? createUserFromLineProfile(profile);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token || !jwtSecret) return null;

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload === "string" || !("userId" in payload)) return null;

    const userId = (payload as UserSessionPayload).userId;
    if (userId === undefined) return null;
    console.log("GET CURRENT USER PAYLOAD:", payload);
    return await getUserById(userId);
  } catch (error) {
    console.error("GET CURRENT USER ERROR:", error);
    return null;
  }
}
export async function updateUser(
  userId: UserId,
  payload: UpdateUserPayload,
): Promise<User> {
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
    console.error("UPDATE USER ERROR:", error.message);
    throw new Error("Failed to update user");
  }

  return user;
}
