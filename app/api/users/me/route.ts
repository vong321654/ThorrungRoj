import { getCurrentUser } from "@/app/api/services/userService";

export async function GET() {
  try {
    const data = await getCurrentUser();
    return Response.json({
      status: "success",
      message: data ? "Current user retrieved successfully" : "No current user",
      data,
    });
  } catch {
    return Response.json(
      {
        status: "error",
        message: "Failed to get current user",
        data: null,
      },
      { status: 500 },
    );
  }
}
