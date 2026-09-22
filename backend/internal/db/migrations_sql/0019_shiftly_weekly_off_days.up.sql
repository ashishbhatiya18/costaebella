ALTER TABLE employees ADD COLUMN weekly_off_days SMALLINT[] NOT NULL DEFAULT '{0}';
ALTER TABLE employees DROP COLUMN leaves_per_week;
