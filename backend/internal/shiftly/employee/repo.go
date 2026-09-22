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
		SELECT id, name, shift_name, monthly_pay_cents, weekly_off_days,
		       eligible_hours_per_day, start_date::text, active, created_at, updated_at
		FROM employees ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("query employees: %w", err)
	}
	defer rows.Close()

	var out []Employee
	for rows.Next() {
		var e Employee
		var offDays []int16
		if err := rows.Scan(&e.ID, &e.Name, &e.ShiftName, &e.MonthlyPayCents, &offDays,
			&e.EligibleHoursPerDay, &e.StartDate, &e.Active, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan employee: %w", err)
		}
		e.WeeklyOffDays = int16sToInts(offDays)
		out = append(out, e)
	}
	return out, nil
}

func (r *Repo) Get(ctx context.Context, id string) (*Employee, error) {
	var e Employee
	var offDays []int16
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, shift_name, monthly_pay_cents, weekly_off_days,
		       eligible_hours_per_day, start_date::text, active, created_at, updated_at
		FROM employees WHERE id = $1`, id).Scan(
		&e.ID, &e.Name, &e.ShiftName, &e.MonthlyPayCents, &offDays,
		&e.EligibleHoursPerDay, &e.StartDate, &e.Active, &e.CreatedAt, &e.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get employee: %w", err)
	}
	e.WeeklyOffDays = int16sToInts(offDays)
	return &e, nil
}

func (r *Repo) Create(ctx context.Context, e Employee) (*Employee, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO employees (name, shift_name, monthly_pay_cents, weekly_off_days, eligible_hours_per_day, start_date, active)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		e.Name, e.ShiftName, e.MonthlyPayCents, intsToInt16s(e.WeeklyOffDays), e.EligibleHoursPerDay, e.StartDate, e.Active).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("insert employee: %w", err)
	}
	return r.Get(ctx, id)
}

func (r *Repo) Update(ctx context.Context, id string, e Employee) (*Employee, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE employees SET name=$1, shift_name=$2, monthly_pay_cents=$3, weekly_off_days=$4,
		       eligible_hours_per_day=$5, start_date=$6, active=$7, updated_at=now()
		WHERE id=$8`,
		e.Name, e.ShiftName, e.MonthlyPayCents, intsToInt16s(e.WeeklyOffDays), e.EligibleHoursPerDay, e.StartDate, e.Active, id)
	if err != nil {
		return nil, fmt.Errorf("update employee: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, nil
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
