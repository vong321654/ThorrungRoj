import { apiError } from "@/app/api/response";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAllAnnouncements,
  getPublishedAnnouncements,
  updateAnnouncement,
} from "@/app/api/services/announcementService";
import { authenticateAdmin } from "@/app/api/admin/authorization";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getAnnouncementId(request: Request) {
  return new URL(request.url).searchParams.get("id")?.trim() || null;
}

function invalidIdResponse() {
  return Response.json(apiError("A valid announcement id is required"), {
    status: 400,
  });
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const scope = searchParams.get("scope");
  const id = getAnnouncementId(request);

  if (scope !== null && scope !== "all") {
    return Response.json(apiError("Invalid announcement scope"), { status: 400 });
  }
  if (id && !UUID_PATTERN.test(id)) return invalidIdResponse();

  if (scope === "all") {
    const auth = await authenticateAdmin(request);
    if (auth instanceof Response) return auth;
    const response = await getAllAnnouncements(auth, id ?? undefined);
    return Response.json(response.result, { status: response.status });
  }

  const response = await getPublishedAnnouncements(id ?? undefined);
  return Response.json(response.result, { status: response.status });
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const payload = await request.json().catch(() => null);
  const response = await createAnnouncement(auth, payload);
  return Response.json(response.result, { status: response.status });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const id = getAnnouncementId(request);
  if (!id || !UUID_PATTERN.test(id)) return invalidIdResponse();

  const payload = await request.json().catch(() => null);
  const response = await updateAnnouncement(auth, id, payload);
  return Response.json(response.result, { status: response.status });
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const id = getAnnouncementId(request);
  if (!id || !UUID_PATTERN.test(id)) return invalidIdResponse();

  const response = await deleteAnnouncement(auth, id);
  return Response.json(response.result, { status: response.status });
}
