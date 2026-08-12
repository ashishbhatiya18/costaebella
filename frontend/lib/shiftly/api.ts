// Shiftly-specific endpoints. Auth (Google Sign-In), token storage, and the
// underlying fetch helper now live in lib/admin/api.ts and are shared with
// the rest of /admin — re-exported here so existing shiftly imports keep
// working unchanged.
import { apiRequest, ApiError, getToken, setToken, clearToken } from "@/lib/admin/api";

export { ApiError, getToken, setToken, clearToken };

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, options, "/admin/login");
}

export const api = {
  listEmployees: () => request<Employee[]>("/api/employees/"),
  getEmployee: (id: string) => request<Employee>(`/api/employees/${id}`),
  createEmployee: (e: Partial<Employee>) =>
    request<Employee>("/api/employees/", {
      method: "POST",
      body: JSON.stringify(e),
    }),
  updateEmployee: (id: string, e: Partial<Employee>) =>
    request<Employee>(`/api/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(e),
    }),
  deleteEmployee: (id: string) =>
    request<void>(`/api/employees/${id}`, { method: "DELETE" }),

  logAttendance: (body: {
    employee_id: string;
    date?: string;
    field: "login" | "logout";
    time?: string;
  }) =>
    request<AttendanceLog>("/api/attendance/log", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listAttendance: (params: {
    employee_id?: string;
    from: string;
    to: string;
  }) => {
    const q = new URLSearchParams();
    if (params.employee_id) q.set("employee_id", params.employee_id);
    q.set("from", params.from);
    q.set("to", params.to);
    return request<AttendanceLog[]>(`/api/attendance?${q.toString()}`);
  },

  overrideAttendance: (body: {
    employee_id: string;
    date: string;
    is_leave: boolean;
    sessions: { login_time: string; logout_time: string | null }[];
  }) =>
    request<AttendanceLog[]>("/api/attendance/override", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  recentActivity: (params: { employeeId?: string; limit: number; offset: number }) => {
    const q = new URLSearchParams();
    if (params.employeeId) q.set("employee_id", params.employeeId);
    q.set("limit", String(params.limit));
    q.set("offset", String(params.offset));
    return request<ActivityResponse>(`/api/attendance/activity?${q.toString()}`);
  },

  attendanceSummary: (range: "week" | "month" | "quarter", anchorDate: string) =>
    request<AttendanceSummaryResponse>(
      `/api/summary/attendance?range=${range}&anchor_date=${anchorDate}`,
    ),

  payoutSummary: (month: string) =>
    request<PayoutSummaryResponse>(`/api/summary/payout?month=${month}`),
};

export type ShiftInterval = {
  id?: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
};

export type Employee = {
  id: string;
  name: string;
  shift_name: string;
  monthly_pay_cents: number;
  committed_working_days: number[];
  permitted_leaves_per_month: number;
  start_date: string;
  active: boolean;
  shift_intervals: ShiftInterval[];
  created_at?: string;
  updated_at?: string;
};

export type AttendanceLog = {
  id: string;
  employee_id: string;
  log_date: string;
  login_time: string | null;
  logout_time: string | null;
  auto_logout: boolean;
  is_leave: boolean;
};

export type ActivityItem = {
  employee_id: string;
  employee_name: string;
  field: "login" | "logout";
  at: string;
};

export type ActivityResponse = {
  items: ActivityItem[];
  has_more: boolean;
};

export type DayCategory =
  | "before_start"
  | "weekly_off"
  | "weekly_off_worked"
  | "leave"
  | "unpaid_leave"
  | "absent"
  | "half_day"
  | "full_day"
  | "full_day_ot";

export type DayAvailability = {
  date: string;
  before_start: boolean;
  is_weekly_off: boolean;
  within_availability: boolean;
  present: boolean;
  leave: boolean;
  auto_logout: boolean;
  hours_worked: number;
  expected_hours: number;
  hours_pct: number;
  category: DayCategory;
  day_credit: number;
  bonus_hours: number;
};

export type EmployeeAvailability = {
  employee_id: string;
  employee_name: string;
  expected_days: number;
  actual_days: number;
  expected_hours: number;
  actual_hours: number;
  attendance_pct: number;
  days: DayAvailability[];
};

export type AttendanceSummaryResponse = {
  range: string;
  from: string;
  to: string;
  employees: EmployeeAvailability[];
};

export type EmployeePayout = {
  employee_id: string;
  employee_name: string;
  monthly_pay_cents: number;
  full_monthly_pay_cents: number;
  total_days: number;
  full_day_count: number;
  half_day_count: number;
  absent_count: number;
  weekly_off_count: number;
  leaves_taken: number;
  permitted_leaves: number;
  unpaid_leave_days: number;
  bonus_hours: number;
  base_pay_cents: number;
  bonus_pay_cents: number;
  payout_cents: number;
  prorated_fraction: number;
};

export type PayoutSummaryResponse = {
  month: string;
  employees: EmployeePayout[];
};
