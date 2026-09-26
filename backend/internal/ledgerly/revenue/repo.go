package revenue

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

var errSaleNotFound = errors.New("sale not found")

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

func (r *Repo) InsertSale(ctx context.Context, req SaleRequest, loggedBy string) (*Sale, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin insert sale: %w", err)
	}
	defer tx.Rollback(ctx)

	var s Sale
	err = tx.QueryRow(ctx, `
		INSERT INTO ledgerly_sales (sale_date, amount_cents, payment_method, notes, logged_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, sale_date::text, amount_cents, payment_method, notes, logged_by`,
		req.SaleDate, req.AmountCents, req.PaymentMethod, req.Notes, loggedBy).Scan(
		&s.ID, &s.SaleDate, &s.AmountCents, &s.PaymentMethod, &s.Notes, &s.LoggedBy)
	if err != nil {
		return nil, fmt.Errorf("insert sale: %w", err)
	}

	for _, name := range req.ItemNames {
		if name == "" {
			continue
		}
		if _, err := tx.Exec(ctx, `INSERT INTO ledgerly_sale_items (sale_id, item_name) VALUES ($1, $2)`, s.ID, name); err != nil {
			return nil, fmt.Errorf("insert sale item: %w", err)
		}
		s.ItemNames = append(s.ItemNames, name)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit insert sale: %w", err)
	}
	return &s, nil
}

func (r *Repo) DeleteSale(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM ledgerly_sales WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete sale: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errSaleNotFound
	}
	return nil
}

func (r *Repo) ListSales(ctx context.Context, from, to string) ([]Sale, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT s.id, s.sale_date::text, s.amount_cents, s.payment_method, s.notes, s.logged_by,
		       COALESCE(array_agg(si.item_name) FILTER (WHERE si.item_name IS NOT NULL), '{}')
		FROM ledgerly_sales s
		LEFT JOIN ledgerly_sale_items si ON si.sale_id = s.id
		WHERE s.sale_date BETWEEN $1 AND $2
		GROUP BY s.id
		ORDER BY s.sale_date DESC, s.created_at DESC`, from, to)
	if err != nil {
		return nil, fmt.Errorf("query sales: %w", err)
	}
	defer rows.Close()

	var out []Sale
	for rows.Next() {
		var s Sale
		if err := rows.Scan(&s.ID, &s.SaleDate, &s.AmountCents, &s.PaymentMethod, &s.Notes, &s.LoggedBy, &s.ItemNames); err != nil {
			return nil, fmt.Errorf("scan sale: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// RangeRevenue computes total revenue across [from, to] from per-sale
// entries only.
func (r *Repo) RangeRevenue(ctx context.Context, from, to string) (int64, error) {
	var total int64
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_cents), 0) FROM ledgerly_sales
		WHERE sale_date BETWEEN $1 AND $2`, from, to).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("sum sales: %w", err)
	}
	return total, nil
}

// RangeRevenueByMethod computes revenue across [from, to] from per-sale
// entries, broken down by payment method ("cash", "card", "upi", "other").
// Each sale's free-text payment_method is normalized and folded into
// "other" if it doesn't match a known method.
func (r *Repo) RangeRevenueByMethod(ctx context.Context, from, to string) (map[string]int64, error) {
	totals := map[string]int64{"cash": 0, "card": 0, "upi": 0, "other": 0}

	rows, err := r.pool.Query(ctx, `
		SELECT payment_method, SUM(amount_cents)
		FROM ledgerly_sales
		WHERE sale_date BETWEEN $1 AND $2
		GROUP BY payment_method`, from, to)
	if err != nil {
		return nil, fmt.Errorf("query sale totals: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var method string
		var sum int64
		if err := rows.Scan(&method, &sum); err != nil {
			return nil, fmt.Errorf("scan sale total: %w", err)
		}
		totals[normalizePaymentMethod(method)] += sum
	}
	return totals, rows.Err()
}

func normalizePaymentMethod(method string) string {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case "cash":
		return "cash"
	case "card":
		return "card"
	case "upi":
		return "upi"
	default:
		return "other"
	}
}
