import { getCurrentUser } from "@/app/api/services/userService";
import { headers } from "next/headers";

export async function GET() {
  const authorization = (await headers()).get("authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");
  const result = await getCurrentUser(accessToken || undefined);
  return Response.json(result, {
    status: result.status === "success" ? 200 : 500,
  });
}
