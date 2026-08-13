import {
  addBrand,
  deleteBrand,
  getAllBrand,
  getBrandById,
  updateBrand,
} from "../../services/brandService";
import { apiError } from "@/app/api/response";
import { authenticateAdmin } from "../../admin/authorization";
import { isSuperAdmin } from "@/app/api/services/adminService";
import type { IDNAMEPAYLOAD, NAMEPAYLOAD } from "@/app/models/api";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    //get item
    const res = await getBrandById(Number(id));
    return Response.json(res, {
      status: res.status === "success" ? 200 : 404,
    });
  } else {
    //get all items
    const result = await getAllBrand();
    return Response.json(result, {
      status: result.status === "success" ? 200 : 500,
    });
  }
}

export async function POST(req: Request) {
  const auth = await authenticateAdmin(req);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth)) {
    return Response.json(apiError("Only a super admin can add brands"), { status: 403 });
  }

  const queryName = new URL(req.url).searchParams.get("name");
  const body = (await req.json().catch(() => null)) as NAMEPAYLOAD | null;
  const name = queryName ?? (typeof body?.name === "string" ? body.name : null);

  if (!name?.trim()) {
    return Response.json(apiError("Brand name is required"), { status: 400 });
  }

  const result = await addBrand(name.trim(), auth.supabase, auth.admin.id);
  return Response.json(result, {
    status: result.status === "success" ? 201 : 500,
  });
}

export async function PATCH(req: Request) {
  const auth = await authenticateAdmin(req);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth)) {
    return Response.json(apiError("Only a super admin can edit brands"), { status: 403 });
  }

  const data = (await req.json().catch(() => null)) as IDNAMEPAYLOAD | null;
  const id = typeof data?.id === "number" ? data.id : null;
  const name = typeof data?.name === "string" ? data.name : null;
  if (!id || !name?.trim()) {
    return Response.json(apiError("Brand id and name are required"), { status: 400 });
  }

  const result = await updateBrand(id, name.trim(), auth.supabase, auth.admin.id);
  return Response.json(result, {
    status: result.status === "success" ? 200 : 500,
  });
}

export async function DELETE(req: Request) {
  const auth = await authenticateAdmin(req);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth)) {
    return Response.json(apiError("Only a super admin can delete brands"), { status: 403 });
  }

  const idValue = new URL(req.url).searchParams.get("id");
  const id = idValue !== null ? Number(idValue) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json(apiError("Valid brand id is required"), { status: 400 });
  }

  const result = await deleteBrand(id, auth.supabase);
  return Response.json(result, {
    status: result.status === "success" ? 200 : 400,
  });
}
