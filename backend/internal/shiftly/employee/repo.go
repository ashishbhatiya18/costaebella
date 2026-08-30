package employee

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

func (r *Repo) List(ctx context.Context) ([]Employee, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, shift_name, monthly_pay_cents, committed_working_days,
		       permitted_leaves_per_month, start_date::text, active, created_at, updated_at
		FROM employees ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("query employees: %w", err)
	}
	defer rows.Close()

	var out []Employee
	for rows.Next() {
		var e Employee
		var days []int16
		if err := rows.Scan(&e.ID, &e.Name, &e.ShiftName, &e.MonthlyPayCents, &days,
			&e.PermittedLeavesPerMonth, &e.StartDate, &e.Active, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan employee: %w", err)
		}
		e.CommittedWorkingDays = int16sToInts(days)
		out = append(out, e)
	}

	for i := range out {
		intervals, err := r.listIntervals(ctx, out[i].ID)
		if err != nil {
			return nil, err
		}
		out[i].ShiftIntervals = intervals
	}
	return out, nil
}

func (r *Repo) Get(ctx context.Context, id string) (*Employee, error) {
	var e Employee
	var days []int16
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, shift_name, monthly_pay_cents, committed_working_days,
		       permitted_leaves_per_month, start_date::text, active, created_at, updated_at
		FROM employees WHERE id = $1`, id).Scan(
		&e.ID, &e.Name, &e.ShiftName, &e.MonthlyPayCents, &days,
		&e.PermittedLeavesPerMonth, &e.StartDate, &e.Active, &e.CreatedAt, &e.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get employee: %w", err)
	}
	e.CommittedWorkingDays = int16sToInts(days)

	intervals, err := r.listIntervals(ctx, e.ID)
	if err != nil {
		return nil, err
	}
	e.ShiftIntervals = intervals
	return &e, nil
}

func (r *Repo) listIntervals(ctx context.Context, employeeID string) ([]ShiftInterval, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, day_of_week, to_char(start_time, 'HH24:MI'), to_char(end_time, 'HH24:MI')
		FROM employee_shift_intervals WHERE employee_id = $1 ORDER BY day_of_week NULLS FIRST, start_time`, employeeID)
	if err != nil {
		return nil, fmt.Errorf("query intervals: %w", err)
	}
	defer rows.Close()

	var out []ShiftInterval
	for rows.Next() {
		var si ShiftInterval
		var dow *int16
		if err := rows.Scan(&si.ID, &dow, &si.StartTime, &si.EndTime); err != nil {
			return nil, fmt.Errorf("scan interval: %w", err)
		}
		if dow != nil {
			v := int(*dow)
			si.DayOfWeek = &v
		}
		out = append(out, si)
	}
	return out, nil
}

func (r *Repo) Create(ctx context.Context, e Employee) (*Employee, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO employees (name, shift_name, monthly_pay_cents, committed_working_days, permitted_leaves_per_month, start_date, active)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		e.Name, e.ShiftName, e.MonthlyPayCents, intsToInt16s(e.CommittedWorkingDays), e.PermittedLeavesPerMonth, e.StartDate, e.Active).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("insert employee: %w", err)
	}

	if err := insertIntervals(ctx, tx, id, e.ShiftIntervals); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return r.Get(ctx, id)
}

func (r *Repo) Update(ctx context.Context, id string, e Employee) (*Employee, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE employees SET name=$1, shift_name=$2, monthly_pay_cents=$3, committed_working_days=$4,
		       permitted_leaves_per_month=$5, start_date=$6, active=$7, updated_at=now()
		WHERE id=$8`,
		e.Name, e.ShiftName, e.MonthlyPayCents, intsToInt16s(e.CommittedWorkingDays), e.PermittedLeavesPerMonth, e.StartDate, e.Active, id)
	if err != nil {
		return nil, fmt.Errorf("update employee: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, nil
	}

	if _, err := tx.Exec(ctx, `DELETE FROM employee_shift_intervals WHERE employee_id = $1`, id); err != nil {
		return nil, fmt.Errorf("clear intervals: %w", err)
	}
	if err := insertIntervals(ctx, tx, id, e.ShiftIntervals); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return r.Get(ctx, id)
}

func (r *Repo) Delete(ctx context.Context, id string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM employees WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("delete employee: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

func insertIntervals(ctx context.Context, tx pgx.Tx, employeeID string, intervals []ShiftInterval) error {
	for _, si := range intervals {
		if _, err := tx.Exec(ctx, `
			INSERT INTO employee_shift_intervals (employee_id, day_of_week, start_time, end_time)
			VALUES ($1, $2, $3, $4)`, employeeID, si.DayOfWeek, si.StartTime, si.EndTime); err != nil {
			return fmt.Errorf("insert interval: %w", err)
		}
	}
	return nil
}

func int16sToInts(in []int16) []int {
	out := make([]int, len(in))
	for i, v := range in {
		out[i] = int(v)
	}
	return out
}

func intsToInt16s(in []int) []int16 {
	out := make([]int16, len(in))
	for i, v := range in {
		out[i] = int16(v)
	}
	return out
}
