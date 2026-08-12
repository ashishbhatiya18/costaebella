-- attendance_logs moves from "one row per employee per day" to "one row per
-- login/logout session" so split-shift employees can log multiple sessions
-- in a single day. A day's total hours worked is now the sum of that day's
-- session durations. is_leave=true rows remain a day-level marker (by
-- application convention, the only row for that day when leave is set).
ALTER TABLE attendance_logs DROP CONSTRAINT IF EXISTS attendance_logs_employee_id_log_date_key;
