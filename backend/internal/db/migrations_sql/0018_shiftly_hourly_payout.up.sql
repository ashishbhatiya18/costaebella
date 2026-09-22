ALTER TABLE employees ADD COLUMN leaves_per_week INTEGER NOT NULL DEFAULT 1;
ALTER TABLE employees ADD COLUMN eligible_hours_per_day DOUBLE PRECISION NOT NULL DEFAULT 9;

DROP TABLE IF EXISTS employee_shift_intervals;
ALTER TABLE employees DROP COLUMN committed_working_days;
ALTER TABLE employees DROP COLUMN permitted_leaves_per_month;
