import {
  getAllAttendance,
  getEmployeeAttendance,
  getMyAttendance,
} from "../services/attendService";
import { getBearerToken } from "../util/supabase/authenticated";

export async function GET(request: Request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return Response.json({ message: "Missing access token" }, { status: 401 });
  }

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId") ?? url.searchParams.get("empId");
  const scope = url.searchParams.get("scope");

  if (scope && scope !== "all") {
    return Response.json({ message: "Invalid attendance scope" }, { status: 400 });
  }
  if (scope === "all" && employeeId) {
    return Response.json({ message: "Use either scope=all or employeeId" }, { status: 400 });
  }

  const response = scope === "all"
    ? await getAllAttendance(accessToken)
    : employeeId
      ? await getEmployeeAttendance(accessToken, employeeId)
      : await getMyAttendance(accessToken);

  return Response.json(response.result, { status: response.status });
}
