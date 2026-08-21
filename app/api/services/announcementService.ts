import type { ADMINAUTH } from "@/app/models/admin";
import type { SERVICERESULT } from "@/app/models/api";
import {
  ANNOUNCEMENTTYPE,
  ISANNOUNCEMENTTYPE,
  type ANNOUNCEMENT,
  type ANNOUNCEMENTPAYLOAD,
  type ANNOUNCEMENTUPDATEVALUES,
  type ANNOUNCEMENTWRITEVALUES,
} from "@/app/models/announcement";
import { createPublicClient } from "@/app/api/util/supabase/public";
import { apiError, apiSuccess } from "../response";
import { isAdminOrSuperAdmin } from "./adminService";

const ANNOUNCEMENTFIELDS =
  "id, postedBy, title, content, imageUrl, type, isPublished, publishedAt, expiresAt, createdAt";

function failure<T>(message: string, status: number): SERVICERESULT<T> {
  return { result: apiError(message), status };
}

function databaseFailure<T>(message: string, error: { message?: string }) {
  const detail =
    process.env.NODE_ENV === "development" && error.message
      ? `: ${error.message}`
      : "";
  return failure<T>(`${message}${detail}`, 500);
}

function parseAnnouncementPayload(
  payload: unknown,
  requireTitle: boolean,
): { values: ANNOUNCEMENTWRITEVALUES } | { message: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { message: "Invalid announcement payload" };
  }

  const input = payload as ANNOUNCEMENTPAYLOAD;
  const values: ANNOUNCEMENTWRITEVALUES = {};

  if ("title" in input) {
    if (
      typeof input.title !== "string" ||
      !input.title.trim() ||
      input.title.trim().length > 200
    ) {
      return { message: "Announcement title must contain 1 to 200 characters" };
    }
    values.title = input.title.trim();
  } else if (requireTitle) {
    return { message: "Announcement title is required" };
  }

  if ("content" in input) {
    if (input.content !== null && typeof input.content !== "string") {
      return { message: "Announcement content must be a string or null" };
    }
    if (typeof input.content === "string" && input.content.trim().length > 20_000) {
      return { message: "Announcement content is too long" };
    }
    values.content =
      typeof input.content === "string" ? input.content.trim() || null : null;
  }

  if ("imageUrl" in input) {
    if (input.imageUrl !== null && typeof input.imageUrl !== "string") {
      return { message: "Announcement image URL must be a string or null" };
    }
    if (typeof input.imageUrl === "string" && input.imageUrl.trim().length > 2_048) {
      return { message: "Announcement image URL is too long" };
    }
    values.imageUrl =
      typeof input.imageUrl === "string" ? input.imageUrl.trim() || null : null;
  }

  if ("type" in input) {
    if (!ISANNOUNCEMENTTYPE(input.type)) {
      return { message: "Announcement type must be promotion or announcement" };
    }
    values.type = input.type;
  }

  if ("isPublished" in input) {
    if (typeof input.isPublished !== "boolean") {
      return { message: "Announcement published status must be a boolean" };
    }
    values.isPublished = input.isPublished;
  }

  if ("expiresAt" in input) {
    if (input.expiresAt === null || input.expiresAt === "") {
      values.expiresAt = null;
    } else if (
      typeof input.expiresAt !== "string" ||
      Number.isNaN(Date.parse(input.expiresAt))
    ) {
      return { message: "Announcement expiration must be a valid date or null" };
    } else {
      values.expiresAt = new Date(input.expiresAt).toISOString();
    }
  }

  if (Object.keys(values).length === 0) {
    return { message: "No editable announcement fields supplied" };
  }

  return { values };
}

export async function getPublishedAnnouncements(
  id?: string,
): Promise<SERVICERESULT<ANNOUNCEMENT | ANNOUNCEMENT[]>> {
  const now = new Date().toISOString();
  const query = createPublicClient()
    .from("announcements")
    .select(ANNOUNCEMENTFIELDS)
    .eq("isPublished", true)
    .or(`expiresAt.is.null,expiresAt.gt.${now}`)
    .order("publishedAt", { ascending: false, nullsFirst: false })
    .order("createdAt", { ascending: false });

  if (id) {
    const { data, error } = await query.eq("id", id).maybeSingle();
    if (error) return databaseFailure("Failed to fetch announcement", error);
    if (!data) return failure("Announcement not found", 404);
    return { result: apiSuccess("Announcement retrieved successfully", data as ANNOUNCEMENT), status: 200 };
  }

  const { data, error } = await query;
  if (error) return databaseFailure("Failed to fetch announcements", error);
  return {
    result: apiSuccess("Announcements retrieved successfully", (data ?? []) as ANNOUNCEMENT[]),
    status: 200,
  };
}

export async function getAllAnnouncements(
  auth: ADMINAUTH,
  id?: string,
): Promise<SERVICERESULT<ANNOUNCEMENT | ANNOUNCEMENT[]>> {
  if (!isAdminOrSuperAdmin(auth)) {
    return failure("Only admins can view all announcements", 403);
  }

  const query = auth.supabase
    .from("announcements")
    .select(ANNOUNCEMENTFIELDS)
    .order("createdAt", { ascending: false });

  if (id) {
    const { data, error } = await query.eq("id", id).maybeSingle();
    if (error) return databaseFailure("Failed to fetch announcement", error);
    if (!data) return failure("Announcement not found", 404);
    return { result: apiSuccess("Announcement retrieved successfully", data as ANNOUNCEMENT), status: 200 };
  }

  const { data, error } = await query;
  if (error) return databaseFailure("Failed to fetch announcements", error);
  return {
    result: apiSuccess("Announcements retrieved successfully", (data ?? []) as ANNOUNCEMENT[]),
    status: 200,
  };
}

export async function createAnnouncement(
  auth: ADMINAUTH,
  payload: unknown,
): Promise<SERVICERESULT<ANNOUNCEMENT>> {
  if (!isAdminOrSuperAdmin(auth)) {
    return failure("Only admins can create announcements", 403);
  }

  const parsed = parseAnnouncementPayload(payload, true);
  if ("message" in parsed) return failure(parsed.message, 400);

  const isPublished = parsed.values.isPublished ?? false;
  const { data, error } = await auth.supabase
    .from("announcements")
    .insert({
      ...parsed.values,
      postedBy: auth.admin.id,
      type: parsed.values.type ?? ANNOUNCEMENTTYPE.ANNOUNCEMENT,
      isPublished,
      publishedAt: isPublished ? new Date().toISOString() : null,
    })
    .select(ANNOUNCEMENTFIELDS)
    .single();

  if (error || !data) {
    return databaseFailure("Failed to create announcement", error ?? {});
  }
  return {
    result: apiSuccess("Announcement created successfully", data as ANNOUNCEMENT),
    status: 201,
  };
}

export async function updateAnnouncement(
  auth: ADMINAUTH,
  id: string,
  payload: unknown,
): Promise<SERVICERESULT<ANNOUNCEMENT>> {
  if (!isAdminOrSuperAdmin(auth)) {
    return failure("Only admins can update announcements", 403);
  }

  const parsed = parseAnnouncementPayload(payload, false);
  if ("message" in parsed) return failure(parsed.message, 400);

  const values: ANNOUNCEMENTUPDATEVALUES = { ...parsed.values };
  if (parsed.values.isPublished !== undefined) {
    values.publishedAt = parsed.values.isPublished
      ? new Date().toISOString()
      : null;
  }

  const { data, error } = await auth.supabase
    .from("announcements")
    .update(values)
    .eq("id", id)
    .select(ANNOUNCEMENTFIELDS)
    .maybeSingle();

  if (error) return databaseFailure("Failed to update announcement", error);
  if (!data) return failure("Announcement not found", 404);
  return {
    result: apiSuccess("Announcement updated successfully", data as ANNOUNCEMENT),
    status: 200,
  };
}

export async function deleteAnnouncement(
  auth: ADMINAUTH,
  id: string,
): Promise<SERVICERESULT<ANNOUNCEMENT>> {
  if (!isAdminOrSuperAdmin(auth)) {
    return failure("Only admins can delete announcements", 403);
  }

  const { data, error } = await auth.supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .select(ANNOUNCEMENTFIELDS)
    .maybeSingle();

  if (error) return databaseFailure("Failed to delete announcement", error);
  if (!data) return failure("Announcement not found", 404);
  return {
    result: apiSuccess("Announcement deleted successfully", data as ANNOUNCEMENT),
    status: 200,
  };
}
