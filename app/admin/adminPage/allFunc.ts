import { getCurrentAdmin } from "@/app/api/services/adminService";

export async function getAdmin() {
  const admin = await getCurrentAdmin();
  console.log("getAdmin called", admin);
  const adminData = admin.data.user;
  return adminData;
}
