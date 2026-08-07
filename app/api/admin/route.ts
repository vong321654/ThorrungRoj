import { apiError, apiSuccess } from "@/app/api/response";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import { AdminRole, isAdminRole } from "@/app/models/admin";
import type { CreateAdminCredentials } from "@/app/models/adminLogin";

function isCreateAdminCredentials(
  value: unknown,
): value is CreateAdminCredentials {
  if (!value || typeof value !== "object") return false;

  const credentials = value as Partial<CreateAdminCredentials>;
  return (
    typeof credentials.email === "string" &&
    credentials.email.trim().length > 0 &&
    typeof credentials.password === "string" &&
    credentials.password.length >= 6 &&
    (credentials.name === null || typeof credentials.name === "string") &&
    isAdminRole(credentials.role) &&
    typeof credentials.isActive === "boolean" &&
    (credentials.email_confirm === undefined ||
      typeof credentials.email_confirm === "boolean")
  );
}

export async function POST(request: Request) {
  const accessToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return Response.json(apiError("Missing access token"), { status: 401 });
  }

  const credentials: unknown = await request.json().catch(() => null);
  if (!isCreateAdminCredentials(credentials)) {
    return Response.json(apiError("Invalid admin credentials"), {
      status: 400,
    });
  }

  const supabase = createAdminClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return Response.json(apiError("Invalid admin session"), { status: 401 });
  }

  const { data: currentAdmin, error: adminError } = await supabase
    .from("employees")
    .select("role, isActive")
    .eq("authId", authData.user.id)
    .maybeSingle();

  if (
    adminError ||
    !currentAdmin?.isActive ||
    currentAdmin.role !== AdminRole.SuperAdmin
  ) {
    return Response.json(apiError("Only a super admin can add admins"), {
      status: 403,
    });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: credentials.email.trim(),
    password: credentials.password,
    email_confirm: credentials.email_confirm,
  });

  if (error) {
    return Response.json(apiError("Failed to add admin"), { status: 400 });
  }

  const employeeValues = {
    authId: data.user.id,
    email: credentials.email.trim(),
    name: credentials.name?.trim() || null,
    role: credentials.role,
    isActive: credentials.isActive,
    updatedAt: new Date().toISOString(),
  };

  const { data: existingEmployee, error: lookupError } = await supabase
    .from("employees")
    .select("id")
    .eq("authId", data.user.id)
    .maybeSingle();

  if (lookupError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    return Response.json(apiError("Failed to create employee profile"), {
      status: 500,
    });
  }

  const employeeResult = existingEmployee
    ? await supabase
        .from("employees")
        .update(employeeValues)
        .eq("id", existingEmployee.id)
        .select(
          "id, email, name, avatarUrl, isActive, role, address, tel, thaiId, updatedAt",
        )
        .single()
    : await supabase
        .from("employees")
        .insert(employeeValues)
        .select(
          "id, email, name, avatarUrl, isActive, role, address, tel, thaiId, updatedAt",
        )
        .single();

  if (employeeResult.error) {
    await supabase.auth.admin.deleteUser(data.user.id);
    return Response.json(apiError("Failed to create employee profile"), {
      status: 500,
    });
  }

  return Response.json(
    apiSuccess("Admin created successfully", {
      user: data.user,
      employee: employeeResult.data,
    }),
    { status: 201 },
  );
}
