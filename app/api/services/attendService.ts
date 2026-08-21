// app/api/services/attendService.ts
import { ADMINROLE } from "@/app/models/admin";
import type { SERVICERESULT } from "@/app/models/api";
import type {
  ATTENDANCERECORD,
  AUTHENTICATEDEMPLOYEE,
  EMPLOYEESESSION,
} from "@/app/models/attendance";
import { apiError, apiSuccess } from "../response";
import { createAuthenticatedClient } from "../util/supabase/authenticated";

function failure<T>(message: string, status: number): SERVICERESULT<T> {
  return { result: apiError(message), status };
}

function isAdminOrSuperAdmin(employee: EMPLOYEESESSION) {
  return employee.role === ADMINROLE.ADMIN || employee.role === ADMINROLE.SUPER_ADMIN;
}

function parseNote(payload: unknown): Pick<ATTENDANCERECORD, "note"> | null {
  if (payload === null || payload === undefined) return { note: null };
  if (typeof payload !== "object" || Array.isArray(payload)) return null;

  const note = (payload as { note?: unknown }).note;
  if (note === undefined || note === null) return { note: null };
  if (typeof note !== "string" || note.trim().length > 1_000) return null;
  return { note: note.trim() || null };
}

async function authenticateEmployee(
  accessToken: string | null,
): Promise<SERVICERESULT<AUTHENTICATEDEMPLOYEE>> {
  if (!accessToken) return failure("Missing access token", 401);

  const supabase = createAuthenticatedClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return failure("Invalid or expired session", 401);

  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, role, isActive")
    .eq("authId", authData.user.id)
    .maybeSingle();

  if (error) return failure("Failed to verify employee account", 500);
  if (!employee) return failure("Employee profile was not found", 403);
  if (!employee.isActive) return failure("Employee account is inactive", 403);

  return {
    result: apiSuccess("Employee authenticated", {
      supabase,
      employee: employee as EMPLOYEESESSION,
    }),
    status: 200,
  };
}

async function loadAttendance(
  authenticated: AUTHENTICATEDEMPLOYEE,
  employeeId?: string,
): Promise<SERVICERESULT<ATTENDANCERECORD[]>> {
  let query = authenticated.supabase
    .from("workAttendance")
    .select("id, employeeId, checkInTime, checkOutTime, workDate, note, createdAt")
    .order("workDate", { ascending: false })
    .order("checkInTime", { ascending: false });

  if (employeeId) query = query.eq("employeeId", employeeId);
  const { data, error } = await query;
  if (error) return failure("Failed to load attendance history", 500);

  return {
    result: apiSuccess("Attendance history loaded", (data ?? []) as ATTENDANCERECORD[]),
    status: 200,
  };
}

export async function getMyAttendance(
  accessToken: string | null,
): Promise<SERVICERESULT<ATTENDANCERECORD[]>> {
  const auth = await authenticateEmployee(accessToken);
  if (auth.result.status === "error") return failure(auth.result.message, auth.status);
  return loadAttendance(auth.result.results, auth.result.results.employee.id);
}

export async function getEmployeeAttendance(
  accessToken: string | null,
  employeeId: string,
): Promise<SERVICERESULT<ATTENDANCERECORD[]>> {
  const auth = await authenticateEmployee(accessToken);
  if (auth.result.status === "error") return failure(auth.result.message, auth.status);

  const { employee } = auth.result.results;
  if (employee.id !== employeeId && !isAdminOrSuperAdmin(employee)) {
    return failure("You can only view your own attendance history", 403);
  }

  return loadAttendance(auth.result.results, employeeId);
}

export async function getAllAttendance(
  accessToken: string | null,
): Promise<SERVICERESULT<ATTENDANCERECORD[]>> {
  const auth = await authenticateEmployee(accessToken);
  if (auth.result.status === "error") return failure(auth.result.message, auth.status);
  if (!isAdminOrSuperAdmin(auth.result.results.employee)) {
    return failure("Only an admin or super admin can view all attendance", 403);
  }

  return loadAttendance(auth.result.results);
}

export async function clockIn(
  accessToken: string | null,
  payload: unknown,
): Promise<SERVICERESULT<ATTENDANCERECORD>> {
  const auth = await authenticateEmployee(accessToken);
  if (auth.result.status === "error") return failure(auth.result.message, auth.status);

  const input = parseNote(payload);
  if (!input) return failure("Invalid attendance payload", 400);

  const { supabase, employee } = auth.result.results;
  const { data: openAttendance, error: openError } = await supabase
    .from("workAttendance")
    .select("id")
    .eq("employeeId", employee.id)
    .is("checkOutTime", null)
    .maybeSingle();

  if (openError) return failure("Failed to check current attendance", 500);
  if (openAttendance) return failure("You are already clocked in", 409);

  const { data, error } = await supabase
    .from("workAttendance")
    .insert({ employeeId: employee.id, note: input.note })
    .select("id, employeeId, checkInTime, checkOutTime, workDate, note, createdAt")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return failure("You are already clocked in", 409);
    return failure("Failed to clock in", 500);
  }

  return { result: apiSuccess("Clocked in successfully", data as ATTENDANCERECORD), status: 201 };
}

export async function clockOut(
  accessToken: string | null,
  payload: unknown,
): Promise<SERVICERESULT<ATTENDANCERECORD>> {
  const auth = await authenticateEmployee(accessToken);
  if (auth.result.status === "error") return failure(auth.result.message, auth.status);

  const input = parseNote(payload);
  if (!input) return failure("Invalid attendance payload", 400);

  const { supabase, employee } = auth.result.results;
  const { data: openAttendance, error: openError } = await supabase
    .from("workAttendance")
    .select("id")
    .eq("employeeId", employee.id)
    .is("checkOutTime", null)
    .order("checkInTime", { ascending: false })
    .maybeSingle();

  if (openError) return failure("Failed to check current attendance", 500);
  if (!openAttendance) return failure("No active clock-in was found", 409);

  const values: Pick<ATTENDANCERECORD, "checkOutTime"> &
    Partial<Pick<ATTENDANCERECORD, "note">> = {
    checkOutTime: new Date().toISOString(),
  };
  if (input.note !== null) values.note = input.note;

  const { data, error } = await supabase
    .from("workAttendance")
    .update(values)
    .eq("id", openAttendance.id)
    .select("id, employeeId, checkInTime, checkOutTime, workDate, note, createdAt")
    .single();

  if (error || !data) return failure("Failed to clock out", 500);
  return { result: apiSuccess("Clocked out successfully", data as ATTENDANCERECORD), status: 200 };
}
