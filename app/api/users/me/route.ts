import { getCurrentUser } from "@/app/api/services/userService";

export async function GET() {
  const result = await getCurrentUser();
  return Response.json(result, {
    status: result.status === "success" ? 200 : 500,
  });
}
