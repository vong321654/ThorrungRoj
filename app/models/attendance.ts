import type { ADMINAUTH, ADMINDATA } from "./admin";

export type ATTENDANCERECORD = {
  id: string;
  employeeId: string;
  checkInTime: string;
  checkOutTime: string | null;
  workDate: string;
  note: string | null;
  createdAt: string;
  // มีเฉพาะตอนดึงรายการ ใช้แสดงชื่อพนักงานในหน้าแอดมิน
  employees?: { name: string; email: string } | null;
};

export type EMPLOYEESESSION = Pick<
  ADMINDATA,
  "id" | "role" | "isActive"
>;

export type AUTHENTICATEDEMPLOYEE = Pick<ADMINAUTH, "supabase"> & {
  employee: EMPLOYEESESSION;
};
