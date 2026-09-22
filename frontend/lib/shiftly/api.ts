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
  listEmployees: () => request<Employee[]>("/api/shiftly/employees/"),
  getEmployee: (id: string) => request<Employee>(`/api/shiftly/employees/${id}`),
  createEmployee: (e: Partial<Employee>) =>
    request<Employee>("/api/shiftly/employees/", {
      method: "POST",
      body: JSON.stringify(e),
    }),
  updateEmployee: (id: string, e: Partial<Employee>) =>
    request<Employee>(`/api/shiftly/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(e),
    }),
  deleteEmployee: (id: string) =>
    request<void>(`/api/shiftly/employees/${id}`, { method: "DELETE" }),

  logAttendance: (body: {
    employee_id: string;
    date?: string;
    field: "login" | "logout";
    time?: string;
  }) =>
    request<AttendanceLog>("/api/shiftly/attendance/log", {
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
    return request<AttendanceLog[]>(`/api/shiftly/attendance?${q.toString()}`);
  },

  overrideAttendance: (body: {
    employee_id: string;
    date: string;
    is_leave: boolean;
    is_comp_off: boolean;
    is_weekly_off?: boolean;
    sessions: { login_time: string; logout_time: string | null }[];
  }) =>
    request<AttendanceLog[]>("/api/shiftly/attendance/override", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  recentActivity: (params: { employeeId?: string; limit: number; offset: number }) => {
    const q = new URLSearchParams();
    if (params.employeeId) q.set("employee_id", params.employeeId);
    q.set("limit", String(params.limit));
    q.set("offset", String(params.offset));
    return request<ActivityResponse>(`/api/shiftly/attendance/activity?${q.toString()}`);
  },

  attendanceSummary: (range: "week" | "month" | "quarter", anchorDate: string) =>
    request<AttendanceSummaryResponse>(
      `/api/shiftly/summary/attendance?range=${range}&anchor_date=${anchorDate}`,
    ),

  payoutSummary: (month: string) =>
    request<PayoutSummaryResponse>(`/api/shiftly/summary/payout?month=${month}`),

  laborCostSummary: (from: string, to: string) =>
    request<LaborCostSummaryResponse>(`/api/shiftly/summary/labor-cost?from=${from}&to=${to}`),

  listAdvances: (params: { employee_id?: string; from: string; to: string }) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    if (params.employee_id) q.set("employee_id", params.employee_id);
    return request<Advance[]>(`/api/shiftly/advances/?${q.toString()}`);
  },

  createAdvance: (a: Partial<Advance>) =>
    request<Advance>("/api/shiftly/advances/", {
      method: "POST",
      body: JSON.stringify(a),
    }),

  updateAdvance: (id: string, a: Partial<Advance>) =>
    request<Advance>(`/api/shiftly/advances/${id}`, {
      method: "PUT",
      body: JSON.stringify(a),
    }),

  deleteAdvance: (id: string) =>
    request<void>(`/api/shiftly/advances/${id}`, { method: "DELETE" }),
};

export type Advance = {
  id: string;
  employee_id: string;
  amount_cents: number;
  advance_date: string;
  notes: string;
};

export type Employee = {
  id: string;
  name: string;
  shift_name: string;
  monthly_pay_cents: number;
  weekly_off_days: number[]; // 0=Sun..6=Sat
  eligible_hours_per_day: number;
  start_date: string;
  active: boolean;
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
  is_comp_off: boolean;
  is_weekly_off: boolean;
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

export type DayCategory = "before_start" | "present" | "leave" | "absent" | "weekly_off";

export type DayAvailability = {
  date: string;
  before_start: boolean;
  is_weekly_off: boolean;
  present: boolean;
  leave: boolean;
  auto_logout: boolean;
  hours_worked: number;
  rounded_hours: number;
  expected_hours: number;
  category: DayCategory;
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

export type SessionTimes = {
  login: string; // RFC3339
  logout: string | null; // RFC3339, or null if still open
};

export type DailyPayoutLine = {
  date: string;
  category: "present" | "leave" | "absent" | "weekly_off";
  sessions: SessionTimes[];
  raw_hours: number;
  rounded_hours: number;
  day_pay_cents: number;
};

export type EmployeePayout = {
  employee_id: string;
  employee_name: string;
  monthly_pay_cents: number;
  total_days: number;
  weekly_off_days: number[]; // 0=Sun..6=Sat
  weekly_off_count: number; // actual occurrences of those weekdays in the period
  eligible_hours_per_day: number;
  working_days_in_month: number; // integer — total_days - weekly_off_count
  hourly_rate_cents: number;
  total_hours_worked: number;
  gross_pay_cents: number;
  advance_cents: number;
  net_payout_cents: number;
  daily_breakdown: DailyPayoutLine[];
};

export type PayoutSummaryResponse = {
  month: string;
  employees: EmployeePayout[];
};

export type LaborCostSummaryResponse = {
  from: string;
  to: string;
  days: {
    date: string;
    cost_cents: number;
    irregular_count: number;
    employee_day_count: number;
  }[];
};
