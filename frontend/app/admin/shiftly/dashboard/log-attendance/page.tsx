"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ActivityItem, ApiError, AttendanceLog, Employee } from "@/lib/shiftly/api";
import { Card } from "@/components/shiftly/ui/card";
import { Button } from "@/components/shiftly/ui/button";
import { clsx } from "@/lib/shiftly/clsx";
import { usePageTitle } from "@/lib/admin/use-page-title";

const ACTIVITY_PAGE_SIZE = 10;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const isToday = dateStr === today();
  return isToday
    ? `Today, ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

type AttendanceStatus = "in" | "out" | "none";

// A day can now have multiple sessions (split shifts). Status is "in" if
// the most recently started session hasn't been closed yet, "out" if the
// most recent one has a logout, "none" if nothing's logged (or it's a
// leave day).
function attendanceStatus(logs: AttendanceLog[] | undefined): AttendanceStatus {
  if (!logs || logs.length === 0) return "none";
  const sessions = logs.filter((l) => !l.is_leave && l.login_time);
  if (sessions.length === 0) return "none";
  const latest = sessions.reduce((a, b) =>
    new Date(a.login_time!) > new Date(b.login_time!) ? a : b,
  );
  return latest.logout_time ? "out" : "in";
}

export default function LogAttendancePage() {
  usePageTitle("Log Attendance");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [date, setDate] = useState(today());
  const [editingDate, setEditingDate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customTimeOpen, setCustomTimeOpen] = useState(false);
  const [customTime, setCustomTime] = useState("");
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLimit, setActivityLimit] = useState(ACTIVITY_PAGE_SIZE);
  const [activityLoading, setActivityLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todaysLogs, setTodaysLogs] = useState<Record<string, AttendanceLog[]>>({});

  useEffect(() => {
    api.listEmployees().then((data) => setEmployees(data ?? []));
  }, []);

  async function refreshLogs() {
    try {
      const logs = await api.listAttendance({ from: date, to: date });
      const map: Record<string, AttendanceLog[]> = {};
      for (const l of logs ?? []) {
        (map[l.employee_id] ??= []).push(l);
      }
      setTodaysLogs(map);
    } catch {
      setTodaysLogs({});
    }
  }

  useEffect(() => {
    refreshLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const refreshActivity = useCallback(
    async (limit: number) => {
      setActivityLoading(true);
      try {
        const res = await api.recentActivity({
          employeeId: selectedId ?? undefined,
          limit,
          offset: 0,
        });
        setActivity(res.items ?? []);
        setActivityHasMore(res.has_more);
      } catch {
        setActivity([]);
        setActivityHasMore(false);
      } finally {
        setActivityLoading(false);
      }
    },
    [selectedId],
  );

  useEffect(() => {
    setActivityLimit(ACTIVITY_PAGE_SIZE);
    refreshActivity(ACTIVITY_PAGE_SIZE);
  }, [selectedId, refreshActivity]);

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter((e) => e.name.toLowerCase().includes(q));
  }, [employees, search]);

  const selected = employees.find((e) => e.id === selectedId) ?? null;
  const selectedLogs = selectedId ? todaysLogs[selectedId] : undefined;
  const selectedStatus = attendanceStatus(selectedLogs);

  async function submit(field: "login" | "logout") {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      let timeIso: string | undefined;
      if (customTimeOpen && customTime) {
        const [h, m] = customTime.split(":").map(Number);
        const dt = new Date(date + "T00:00:00");
        dt.setHours(h, m, 0, 0);
        timeIso = dt.toISOString();
      }
      await api.logAttendance({
        employee_id: selected.id,
        date,
        field,
        time: timeIso,
      });
      setCustomTimeOpen(false);
      setCustomTime("");
      setSelectedId(null);
      await refreshLogs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log attendance.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-navy">Log Attendance</h1>
        <p className="mt-1 text-sm text-navy/60">
          Pick an employee, then tap Login or Logout — timestamped instantly.
        </p>
      </div>

      {/* Date row */}
      <div className="mb-5 flex items-center gap-3">
        <span className="text-sm text-navy/60">Date:</span>
        {editingDate ? (
          <input
            type="date"
            value={date}
            autoFocus
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => setEditingDate(false)}
            className="rounded-lg border border-navy/15 bg-cream/40 px-2.5 py-1 text-sm text-navy"
          />
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            className="rounded-lg bg-navy/10 px-3 py-1 text-sm font-medium text-navy hover:bg-navy/15"
          >
            {formatDateLabel(date)}
          </button>
        )}
        {date !== today() && (
          <button
            onClick={() => setDate(today())}
            className="text-xs text-teal hover:text-teal/80"
          >
            Reset to today
          </button>
        )}
      </div>

      {/* Employee picker */}
      <Card className="p-4">
        <input
          placeholder="Search employee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2 text-sm text-navy placeholder:text-navy/40 outline-none focus:border-teal"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filteredEmployees.map((e) => {
            const status = attendanceStatus(todaysLogs[e.id]);
            return (
              <button
                key={e.id}
                onClick={() =>
                  setSelectedId((prev) => (prev === e.id ? null : e.id))
                }
                className={clsx(
                  "relative rounded-xl border p-3 text-left transition-colors",
                  selectedId === e.id
                    ? "border-teal bg-teal/10"
                    : "border-navy/10 bg-cream/30 hover:border-navy/20",
                )}
              >
                <span className="block truncate text-sm font-medium text-navy">
                  {e.name}
                </span>
                <span
                  className={clsx(
                    "mt-1 block text-xs",
                    status === "in" && "text-teal",
                    status === "out" && "text-navy/50",
                    status === "none" && "text-navy/40",
                  )}
                >
                  {status === "in" ? "Logged in" : status === "out" ? "Logged out" : "Not logged"}
                </span>
              </button>
            );
          })}
          {filteredEmployees.length === 0 && (
            <p className="col-span-full py-4 text-center text-sm text-navy/50">
              No employees match &quot;{search}&quot;.
            </p>
          )}
        </div>
      </Card>

      {/* Action panel */}
      {selected && (
        <Card className="mt-4 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-navy/60">Logging for</p>
              <p className="text-lg font-semibold text-navy">{selected.name}</p>
            </div>
            <button
              onClick={() => setCustomTimeOpen((v) => !v)}
              className="text-xs font-medium text-teal hover:text-teal/80"
            >
              {customTimeOpen ? "Use current time" : "Custom time"}
            </button>
          </div>

          {customTimeOpen && (
            <input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="mb-4 rounded-lg border border-navy/15 bg-cream/40 px-3 py-2 text-sm text-navy"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="bg-teal hover:bg-teal/90"
              disabled={submitting || selectedStatus === "in"}
              onClick={() => submit("login")}
            >
              {selectedStatus === "in" ? "Already logged in" : `Log Login ${!customTimeOpen ? "(now)" : ""}`}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={submitting || selectedStatus !== "in"}
              onClick={() => submit("logout")}
            >
              {selectedStatus !== "in" ? "Not logged in" : `Log Logout ${!customTimeOpen ? "(now)" : ""}`}
            </Button>
          </div>

          {selectedLogs && selectedLogs.length > 0 && (
            <div className="mt-3 space-y-1 text-xs text-navy/50">
              {selectedLogs.some((l) => l.is_leave) ? (
                <p>On leave</p>
              ) : (
                selectedLogs.map((l) => (
                  <p key={l.id}>
                    {l.login_time &&
                      `In: ${new Date(l.login_time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
                    {l.login_time && l.logout_time && " · "}
                    {l.logout_time
                      ? `Out: ${new Date(l.logout_time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
                      : l.login_time && " · still open"}
                  </p>
                ))
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">
              {error}
            </p>
          )}
        </Card>
      )}

      {/* Recent activity feed */}
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-navy/60">
          {selected ? `Recent activity — ${selected.name}` : "Recent activity"}
        </h3>

        {activity.length === 0 && !activityLoading && (
          <p className="text-sm text-navy/50">No activity yet.</p>
        )}

        <ul className="space-y-1.5">
          {activity.map((item) => (
            <li
              key={`${item.employee_id}-${item.field}-${item.at}`}
              className="flex items-center justify-between rounded-lg bg-white border border-navy/10 px-3 py-2 text-sm"
            >
              <span className="text-navy">{item.employee_name}</span>
              <span
                className={item.field === "login" ? "text-teal" : "text-navy/50"}
              >
                {item.field === "login" ? "Logged in" : "Logged out"} ·{" "}
                {new Date(item.at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>

        {activityHasMore && (
          <button
            onClick={() => {
              const next = activityLimit + ACTIVITY_PAGE_SIZE;
              setActivityLimit(next);
              refreshActivity(next);
            }}
            disabled={activityLoading}
            className="mt-3 text-xs font-medium text-teal hover:text-teal/80 disabled:opacity-50"
          >
            {activityLoading ? "Loading…" : "View more"}
          </button>
        )}
      </div>
    </div>
  );
}
