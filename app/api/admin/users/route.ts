import { apiError, apiSuccess } from "@/app/api/response";
import { authenticateAdmin } from "../authorization";

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const { data, error } = await auth.supabase
    .from("users")
    .select("id, name, phone, email, address, shopName, customerType, isActive, createdAt")
    .order("createdAt", { ascending: false });

  if (error) return Response.json(apiError("Failed to fetch users"), { status: 500 });
  return Response.json(apiSuccess("Users retrieved successfully", data ?? []));
}
