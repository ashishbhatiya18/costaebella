"use client";

import { useEffect, useState } from "react";
import { api, ApiError, Employee } from "@/lib/shiftly/api";
import { Modal } from "@/components/shiftly/ui/modal";
import { Button } from "@/components/shiftly/ui/button";
import { Label } from "@/components/shiftly/ui/input";
import { getShiftSessionsForDate } from "@/lib/shiftly/shift-times";

type SessionRow = { loginTime: string; logoutTime: string };

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function toIso(datetimeLocal: string): string | null {
  if (!datetimeLocal) return null;
  return new Date(datetimeLocal).toISOString();
}

export function AttendanceOverrideModal({
  employee,
  date,
  onClose,
  onSaved,
}: {
  employee: Employee;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const employeeId = employee.id;
  const employeeName = employee.name;
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [isLeave, setIsLeave] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listAttendance({ employee_id: employeeId, from: date, to: date })
      .then((logs) => {
        if (cancelled) return;
        const rows = logs ?? [];
        const leaveMarked = rows.some((l) => l.is_leave);
        setIsLeave(leaveMarked);
        setSessions(
          leaveMarked
            ? []
            : rows.map((l) => ({
                loginTime: toDatetimeLocal(l.login_time),
                logoutTime: toDatetimeLocal(l.logout_time),
              })),
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [employeeId, date]);

  function handleMarkPresent() {
    const shiftSessions = getShiftSessionsForDate(employee, date);
    setSessions(
      shiftSessions.map((s) => ({
        loginTime: toDatetimeLocal(s.login_time),
        logoutTime: toDatetimeLocal(s.logout_time),
      })),
    );
    setIsLeave(false);
  }

  function updateSession(idx: number, patch: Partial<SessionRow>) {
    setSessions((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addSession() {
    setSessions((prev) => [...prev, { loginTime: "", logoutTime: "" }]);
  }

  function removeSession(idx: number) {
    setSessions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payloadSessions = isLeave
        ? []
        : sessions
            .filter((s) => s.loginTime)
            .map((s) => ({
              login_time: toIso(s.loginTime)!,
              logout_time: toIso(s.logoutTime),
            }));

      await api.overrideAttendance({
        employee_id: employeeId,
        date,
        is_leave: isLeave,
        sessions: payloadSessions,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save override.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Override attendance — ${employeeName}`}>
      <p className="mb-4 text-sm text-navy/60">{date}</p>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <div className="space-y-4">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={handleMarkPresent}
            disabled={isLeave}
          >
            Mark as present (use shift hours)
          </Button>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-navy/15 bg-cream/30 px-3.5 py-2.5">
            <input
              type="checkbox"
              checked={isLeave}
              onChange={(e) => setIsLeave(e.target.checked)}
              className="h-4 w-4 rounded border-navy/30 bg-white text-teal focus:ring-teal"
            />
            <span className="text-sm font-medium text-navy">Mark as leave</span>
          </label>

          {!isLeave && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="mb-0">Sessions</Label>
                <button
                  type="button"
                  onClick={addSession}
                  className="text-xs font-medium text-teal hover:text-teal/80"
                >
                  + Add session
                </button>
              </div>

              {sessions.length === 0 && (
                <p className="text-xs text-navy/50">
                  No sessions logged. Add one, or use &quot;Mark as present&quot;.
                </p>
              )}

              {sessions.map((s, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-navy/10 bg-cream/30 p-2.5"
                >
                  <input
                    type="datetime-local"
                    value={s.loginTime}
                    onChange={(e) => updateSession(idx, { loginTime: e.target.value })}
                    className="rounded-lg border border-navy/15 bg-white px-2 py-1.5 text-sm text-navy"
                  />
                  <span className="text-navy/50">to</span>
                  <input
                    type="datetime-local"
                    value={s.logoutTime}
                    onChange={(e) => updateSession(idx, { logoutTime: e.target.value })}
                    className="rounded-lg border border-navy/15 bg-white px-2 py-1.5 text-sm text-navy"
                  />
                  <button
                    type="button"
                    onClick={() => removeSession(idx)}
                    className="ml-auto text-navy/40 hover:text-coral"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-navy/50">
            {isLeave
              ? "Marking as leave clears any sessions logged for this day."
              : "Leave a session's logout blank if it's still open. Saving overrides any auto-logout and is recorded as an admin correction."}
          </p>

          {error && (
            <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save override"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
