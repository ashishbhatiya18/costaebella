package payment

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

func (r *Repo) List(ctx context.Context, category, from, to string) ([]Payment, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, category, amount_cents, payment_date::text, payment_method, payee,
		       employee_id, supplier_id, notes, logged_by, created_at
		FROM ledgerly_payments
		WHERE payment_date BETWEEN $1 AND $2 AND ($3 = '' OR category = $3)
		ORDER BY payment_date DESC, created_at DESC`, from, to, category)
	if err != nil {
		return nil, fmt.Errorf("query payments: %w", err)
	}
	defer rows.Close()

	var out []Payment
	for rows.Next() {
		var p Payment
		if err := rows.Scan(&p.ID, &p.Category, &p.AmountCents, &p.PaymentDate, &p.PaymentMethod, &p.Payee,
			&p.EmployeeID, &p.SupplierID, &p.Notes, &p.LoggedBy, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan payment: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repo) Get(ctx context.Context, id string) (*Payment, error) {
	var p Payment
	err := r.pool.QueryRow(ctx, `
		SELECT id, category, amount_cents, payment_date::text, payment_method, payee,
		       employee_id, supplier_id, notes, logged_by, created_at
		FROM ledgerly_payments WHERE id = $1`, id).Scan(
		&p.ID, &p.Category, &p.AmountCents, &p.PaymentDate, &p.PaymentMethod, &p.Payee,
		&p.EmployeeID, &p.SupplierID, &p.Notes, &p.LoggedBy, &p.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get payment: %w", err)
	}
	return &p, nil
}

func (r *Repo) Create(ctx context.Context, p Payment) (*Payment, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO ledgerly_payments (category, amount_cents, payment_date, payment_method, payee, employee_id, supplier_id, notes, logged_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
		p.Category, p.AmountCents, p.PaymentDate, p.PaymentMethod, p.Payee, p.EmployeeID, p.SupplierID, p.Notes, p.LoggedBy).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("insert payment: %w", err)
	}
	return r.Get(ctx, id)
}

func (r *Repo) Update(ctx context.Context, id string, p Payment) (*Payment, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE ledgerly_payments SET category=$1, amount_cents=$2, payment_date=$3, payment_method=$4,
		       payee=$5, employee_id=$6, supplier_id=$7, notes=$8, updated_at=now()
		WHERE id=$9`,
		p.Category, p.AmountCents, p.PaymentDate, p.PaymentMethod, p.Payee, p.EmployeeID, p.SupplierID, p.Notes, id)
	if err != nil {
		return nil, fmt.Errorf("update payment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, nil
	}
	return r.Get(ctx, id)
}

func (r *Repo) Delete(ctx context.Context, id string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM ledgerly_payments WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("delete payment: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// RangeTotal sums amount_cents for every payment within [from, to],
// regardless of category — used by Ledgerly's P&L summary.
func (r *Repo) RangeTotal(ctx context.Context, from, to string) (int64, error) {
	var total int64
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_cents), 0) FROM ledgerly_payments
		WHERE payment_date BETWEEN $1 AND $2`, from, to).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("sum payments: %w", err)
	}
	return total, nil
}
