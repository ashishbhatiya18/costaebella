package revenue

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

// UpsertDailyLog records the end-of-day cash/card/UPI total for a date,
// creating the day's row if it doesn't exist yet (mirrors pantrly/stock's
// UpsertLog upsert-by-date pattern).
func (r *Repo) UpsertDailyLog(ctx context.Context, date string, req DailyLogRequest, loggedBy string) (*DailyLog, error) {
	var l DailyLog
	err := r.pool.QueryRow(ctx, `
		INSERT INTO ledgerly_revenue_logs (log_date, cash_cents, card_cents, upi_cents, notes, logged_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (log_date) DO UPDATE
		SET cash_cents = $2, card_cents = $3, upi_cents = $4, notes = $5, logged_by = $6, updated_at = now()
		RETURNING id, log_date::text, cash_cents, card_cents, upi_cents, notes, logged_by`,
		date, req.CashCents, req.CardCents, req.UpiCents, req.Notes, loggedBy).Scan(
		&l.ID, &l.LogDate, &l.CashCents, &l.CardCents, &l.UpiCents, &l.Notes, &l.LoggedBy)
	if err != nil {
		return nil, fmt.Errorf("upsert daily revenue log: %w", err)
	}
	return &l, nil
}

func (r *Repo) ListDailyLogs(ctx context.Context, from, to string) ([]DailyLog, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, log_date::text, cash_cents, card_cents, upi_cents, notes, logged_by
		FROM ledgerly_revenue_logs
		WHERE log_date BETWEEN $1 AND $2
		ORDER BY log_date DESC`, from, to)
	if err != nil {
		return nil, fmt.Errorf("query daily revenue logs: %w", err)
	}
	defer rows.Close()

	var out []DailyLog
	for rows.Next() {
		var l DailyLog
		if err := rows.Scan(&l.ID, &l.LogDate, &l.CashCents, &l.CardCents, &l.UpiCents, &l.Notes, &l.LoggedBy); err != nil {
			return nil, fmt.Errorf("scan daily revenue log: %w", err)
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (r *Repo) InsertSale(ctx context.Context, req SaleRequest, loggedBy string) (*Sale, error) {
	var s Sale
	err := r.pool.QueryRow(ctx, `
		INSERT INTO ledgerly_sales (sale_date, amount_cents, payment_method, notes, logged_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, sale_date::text, amount_cents, payment_method, notes, logged_by`,
		req.SaleDate, req.AmountCents, req.PaymentMethod, req.Notes, loggedBy).Scan(
		&s.ID, &s.SaleDate, &s.AmountCents, &s.PaymentMethod, &s.Notes, &s.LoggedBy)
	if err != nil {
		return nil, fmt.Errorf("insert sale: %w", err)
	}
	return &s, nil
}

func (r *Repo) ListSales(ctx context.Context, from, to string) ([]Sale, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, sale_date::text, amount_cents, payment_method, notes, logged_by
		FROM ledgerly_sales
		WHERE sale_date BETWEEN $1 AND $2
		ORDER BY sale_date DESC, created_at DESC`, from, to)
	if err != nil {
		return nil, fmt.Errorf("query sales: %w", err)
	}
	defer rows.Close()

	var out []Sale
	for rows.Next() {
		var s Sale
		if err := rows.Scan(&s.ID, &s.SaleDate, &s.AmountCents, &s.PaymentMethod, &s.Notes, &s.LoggedBy); err != nil {
			return nil, fmt.Errorf("scan sale: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// RangeRevenue computes total revenue across [from, to]: per day, the sum
// of that day's per-sale entries if any exist, else that day's daily log
// total — never both, so a day logged both ways isn't double-counted.
func (r *Repo) RangeRevenue(ctx context.Context, from, to string) (int64, error) {
	var total int64

	saleDates := map[string]bool{}
	rows, err := r.pool.Query(ctx, `
		SELECT sale_date::text, SUM(amount_cents)
		FROM ledgerly_sales
		WHERE sale_date BETWEEN $1 AND $2
		GROUP BY sale_date`, from, to)
	if err != nil {
		return 0, fmt.Errorf("query sale totals: %w", err)
	}
	for rows.Next() {
		var date string
		var sum int64
		if err := rows.Scan(&date, &sum); err != nil {
			rows.Close()
			return 0, fmt.Errorf("scan sale total: %w", err)
		}
		saleDates[date] = true
		total += sum
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	logs, err := r.ListDailyLogs(ctx, from, to)
	if err != nil {
		return 0, err
	}
	for _, l := range logs {
		if saleDates[l.LogDate] {
			continue
		}
		total += l.CashCents + l.CardCents + l.UpiCents
	}

	return total, nil
}
