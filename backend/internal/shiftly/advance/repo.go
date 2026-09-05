package advance

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

func (r *Repo) List(ctx context.Context, employeeID, from, to string) ([]Advance, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, employee_id, amount_cents, advance_date::text, notes, logged_by, created_at
		FROM shiftly_advances
		WHERE advance_date BETWEEN $1 AND $2 AND ($3 = '' OR employee_id = $3::uuid)
		ORDER BY advance_date DESC, created_at DESC`, from, to, employeeID)
	if err != nil {
		return nil, fmt.Errorf("query advances: %w", err)
	}
	defer rows.Close()

	var out []Advance
	for rows.Next() {
		var a Advance
		if err := rows.Scan(&a.ID, &a.EmployeeID, &a.AmountCents, &a.AdvanceDate, &a.Notes, &a.LoggedBy, &a.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan advance: %w", err)
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *Repo) Get(ctx context.Context, id string) (*Advance, error) {
	var a Advance
	err := r.pool.QueryRow(ctx, `
		SELECT id, employee_id, amount_cents, advance_date::text, notes, logged_by, created_at
		FROM shiftly_advances WHERE id = $1`, id).Scan(
		&a.ID, &a.EmployeeID, &a.AmountCents, &a.AdvanceDate, &a.Notes, &a.LoggedBy, &a.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get advance: %w", err)
	}
	return &a, nil
}

func (r *Repo) Create(ctx context.Context, a Advance) (*Advance, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO shiftly_advances (employee_id, amount_cents, advance_date, notes, logged_by)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		a.EmployeeID, a.AmountCents, a.AdvanceDate, a.Notes, a.LoggedBy).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("insert advance: %w", err)
	}
	return r.Get(ctx, id)
}

func (r *Repo) Update(ctx context.Context, id string, a Advance) (*Advance, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE shiftly_advances SET employee_id=$1, amount_cents=$2, advance_date=$3, notes=$4, updated_at=now()
		WHERE id=$5`,
		a.EmployeeID, a.AmountCents, a.AdvanceDate, a.Notes, id)
	if err != nil {
		return nil, fmt.Errorf("update advance: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, nil
	}
	return r.Get(ctx, id)
}

func (r *Repo) Delete(ctx context.Context, id string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM shiftly_advances WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("delete advance: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// RangeTotal sums amount_cents for every advance within [from, to], across
// all employees — used by Ledgerly's P&L summary to fold advances into
// expenses.
func (r *Repo) RangeTotal(ctx context.Context, from, to string) (int64, error) {
	var total int64
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_cents), 0) FROM shiftly_advances
		WHERE advance_date BETWEEN $1 AND $2`, from, to).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("sum advances: %w", err)
	}
	return total, nil
}

// RangeTotalsByEmployee returns, for every employee with at least one
// advance in [from, to], the sum of their advances in that window — used by
// Shiftly's payout summary to net advances already given against the
// computed payout so an employee isn't paid twice.
func (r *Repo) RangeTotalsByEmployee(ctx context.Context, from, to string) (map[string]int64, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT employee_id, COALESCE(SUM(amount_cents), 0)
		FROM shiftly_advances
		WHERE advance_date BETWEEN $1 AND $2
		GROUP BY employee_id`, from, to)
	if err != nil {
		return nil, fmt.Errorf("sum advances by employee: %w", err)
	}
	defer rows.Close()

	out := map[string]int64{}
	for rows.Next() {
		var employeeID string
		var total int64
		if err := rows.Scan(&employeeID, &total); err != nil {
			return nil, fmt.Errorf("scan advance total: %w", err)
		}
		out[employeeID] = total
	}
	return out, rows.Err()
}
