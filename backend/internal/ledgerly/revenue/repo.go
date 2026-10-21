package revenue

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	errSaleNotFound    = errors.New("sale not found")
	errUnknownEmployee = errors.New("unknown employee")
)

// asEmployeeErr maps a bad given_to_employee_id (malformed UUID or no such
// employee) to errUnknownEmployee so the handler can answer 400, not 500.
func asEmployeeErr(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && (pgErr.Code == "23503" || pgErr.Code == "22P02") {
		return errUnknownEmployee
	}
	return err
}

// saleColumns is the SELECT list every sale read shares. given_to prefers
// the linked employee's current name (so a rename in Shiftly shows up),
// falling back to the stored text — the name snapshot taken when logged,
// or the free-text name for a non-staff recipient.
const saleColumns = `
	s.id, s.sale_date::text, s.amount_cents, s.payment_method, s.notes, s.logged_by,
	s.discount_cents, s.discount_reason, s.is_complimentary,
	COALESCE(e.name, s.given_to), s.given_to_employee_id::text`

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

	// For a staff recipient, given_to stores a snapshot of the employee's
	// name so it survives the employee row being deleted.
	var s Sale
	err = tx.QueryRow(ctx, `
		INSERT INTO ledgerly_sales (sale_date, amount_cents, payment_method, notes, logged_by,
		                            discount_cents, discount_reason, is_complimentary,
		                            given_to, given_to_employee_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
		        COALESCE((SELECT name FROM employees WHERE id = $10::uuid), $9), $10::uuid)
		RETURNING id, sale_date::text, amount_cents, payment_method, notes, logged_by,
		          discount_cents, discount_reason, is_complimentary,
		          given_to, given_to_employee_id::text`,
		req.SaleDate, req.AmountCents, req.PaymentMethod, req.Notes, loggedBy,
		req.DiscountCents, req.DiscountReason, req.IsComplimentary,
		req.GivenTo, req.GivenToEmployeeID).Scan(
		&s.ID, &s.SaleDate, &s.AmountCents, &s.PaymentMethod, &s.Notes, &s.LoggedBy,
		&s.DiscountCents, &s.DiscountReason, &s.IsComplimentary,
		&s.GivenTo, &s.GivenToEmployeeID)
	if err != nil {
		return nil, fmt.Errorf("insert sale: %w", asEmployeeErr(err))
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

// UpdateRecipient sets who a discount / complimentary bill was given to,
// the same way InsertSale stores it. Only giveaway bills can carry one.
func (r *Repo) UpdateRecipient(ctx context.Context, id string, req RecipientRequest) (*Sale, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE ledgerly_sales
		SET given_to = COALESCE((SELECT name FROM employees WHERE id = $3::uuid), $2),
		    given_to_employee_id = $3::uuid
		WHERE id = $1 AND (is_complimentary OR discount_cents > 0)`,
		id, req.GivenTo, req.GivenToEmployeeID)
	if err != nil {
		return nil, fmt.Errorf("update sale recipient: %w", asEmployeeErr(err))
	}
	if tag.RowsAffected() == 0 {
		return nil, errSaleNotFound
	}
	return r.getSale(ctx, id)
}

func (r *Repo) getSale(ctx context.Context, id string) (*Sale, error) {
	var s Sale
	err := r.pool.QueryRow(ctx, `
		SELECT `+saleColumns+`,
		       COALESCE(array_agg(si.item_name) FILTER (WHERE si.item_name IS NOT NULL), '{}')
		FROM ledgerly_sales s
		LEFT JOIN employees e ON e.id = s.given_to_employee_id
		LEFT JOIN ledgerly_sale_items si ON si.sale_id = s.id
		WHERE s.id = $1
		GROUP BY s.id, e.name`, id).Scan(
		&s.ID, &s.SaleDate, &s.AmountCents, &s.PaymentMethod, &s.Notes, &s.LoggedBy,
		&s.DiscountCents, &s.DiscountReason, &s.IsComplimentary,
		&s.GivenTo, &s.GivenToEmployeeID, &s.ItemNames)
	if err != nil {
		return nil, fmt.Errorf("get sale: %w", err)
	}
	return &s, nil
}

// RecipientNames lists the distinct non-staff names giveaways have been
// given to, most recently used first — offered as suggestions so the same
// person is typed the same way each time.
func (r *Repo) RecipientNames(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT given_to FROM ledgerly_sales
		WHERE given_to <> '' AND given_to_employee_id IS NULL
		GROUP BY given_to
		ORDER BY MAX(created_at) DESC`)
	if err != nil {
		return nil, fmt.Errorf("query recipient names: %w", err)
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan recipient name: %w", err)
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

func (r *Repo) ListSales(ctx context.Context, from, to string) ([]Sale, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+saleColumns+`,
		       COALESCE(array_agg(si.item_name) FILTER (WHERE si.item_name IS NOT NULL), '{}')
		FROM ledgerly_sales s
		LEFT JOIN employees e ON e.id = s.given_to_employee_id
		LEFT JOIN ledgerly_sale_items si ON si.sale_id = s.id
		WHERE s.sale_date BETWEEN $1 AND $2
		GROUP BY s.id, e.name
		ORDER BY s.sale_date DESC, s.created_at DESC`, from, to)
	if err != nil {
		return nil, fmt.Errorf("query sales: %w", err)
	}
	defer rows.Close()

	var out []Sale
	for rows.Next() {
		var s Sale
		if err := rows.Scan(&s.ID, &s.SaleDate, &s.AmountCents, &s.PaymentMethod, &s.Notes, &s.LoggedBy,
			&s.DiscountCents, &s.DiscountReason, &s.IsComplimentary,
			&s.GivenTo, &s.GivenToEmployeeID, &s.ItemNames); err != nil {
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
