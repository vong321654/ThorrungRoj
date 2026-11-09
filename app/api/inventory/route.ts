import { apiError } from "../response";
import {
  addInventoryItem,
  decreaseCylinder,
  deleteInventoryItem,
  getAllInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
} from "../services/inventoryService";
import { authenticateAdmin } from "../admin/authorization";
import { isAdminOrSuperAdmin } from "../services/adminService";
import type { CREATEINVENTORYPAYLOAD } from "@/app/models/inventory";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (id !== null) {
    if (!id.trim()) {
      return Response.json(apiError("Invalid inventory id"), { status: 400 });
    }

    const result = await getInventoryItemById(id);
    return Response.json(result, {
      status: result.status === "success" ? 200 : 500,
    });
  }

  const result = await getAllInventoryItems();
  return Response.json(result, {
    status: result.status === "success" ? 200 : 500,
  });
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdminOrSuperAdmin(auth)) return Response.json(apiError("Only admins can manage inventory"), { status: 403 });

  const body = (await request.json().catch(() => null)) as CREATEINVENTORYPAYLOAD | null;
  if (!body || typeof body !== "object") {
    return Response.json(apiError("Invalid inventory payload"), { status: 400 });
  }

  const result = await addInventoryItem(body, auth.supabase);
  return Response.json(result.result, { status: result.status });
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdminOrSuperAdmin(auth)) return Response.json(apiError("Only admins can manage inventory"), { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id?.trim()) return Response.json(apiError("Inventory id is required"), { status: 400 });
  const result = await deleteInventoryItem(id, auth.supabase);
  return Response.json(result.result, { status: result.status });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdminOrSuperAdmin(auth)) return Response.json(apiError("Only admins can manage inventory"), { status: 403 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id?.trim()) return Response.json(apiError("Inventory id is required"), { status: 400 });
  if (searchParams.get("action") === "decrease") {
    const result = await decreaseCylinder(id, Number(searchParams.get("quantity") ?? 1), auth.supabase);
    return Response.json(result.result, { status: result.status });
  }
  const body = (await request.json().catch(() => null)) as CREATEINVENTORYPAYLOAD | null;
  if (!body || typeof body !== "object") return Response.json(apiError("Invalid inventory payload"), { status: 400 });
  const result = await updateInventoryItem(id, body, auth.supabase);
  return Response.json(result.result, { status: result.status });
}
