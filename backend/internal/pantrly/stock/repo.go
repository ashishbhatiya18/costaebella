package stock

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

// UpsertLog records an opening or closing quantity for an item+date,
// creating the day's row if it doesn't exist yet (mirrors how attendance
// logs accumulate login/logout on the same row).
func (r *Repo) UpsertLog(ctx context.Context, itemID, date, field string, quantity float64, loggedBy string) (*StockLog, error) {
	column := "opening_qty"
	if field == "closing" {
		column = "closing_qty"
	}

	var l StockLog
	query := fmt.Sprintf(`
		INSERT INTO pantrly_stock_logs (item_id, log_date, %s, logged_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (item_id, log_date) DO UPDATE
		SET %s = $3, logged_by = $4, updated_at = now()
		RETURNING id, item_id, log_date::text, opening_qty, closing_qty, logged_by`, column, column)
	err := r.pool.QueryRow(ctx, query, itemID, date, quantity, loggedBy).Scan(
		&l.ID, &l.ItemID, &l.LogDate, &l.OpeningQty, &l.ClosingQty, &l.LoggedBy)
	if err != nil {
		return nil, fmt.Errorf("upsert stock log: %w", err)
	}
	return &l, nil
}

func (r *Repo) ListLogs(ctx context.Context, itemID, from, to string) ([]StockLog, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, item_id, log_date::text, opening_qty, closing_qty, logged_by
		FROM pantrly_stock_logs
		WHERE log_date BETWEEN $1 AND $2 AND ($3 = '' OR item_id::text = $3)
		ORDER BY log_date, item_id`, from, to, itemID)
	if err != nil {
		return nil, fmt.Errorf("query stock logs: %w", err)
	}
	defer rows.Close()

	var out []StockLog
	for rows.Next() {
		var l StockLog
		if err := rows.Scan(&l.ID, &l.ItemID, &l.LogDate, &l.OpeningQty, &l.ClosingQty, &l.LoggedBy); err != nil {
			return nil, fmt.Errorf("scan stock log: %w", err)
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (r *Repo) InsertPurchase(ctx context.Context, p PurchaseRequest) (*Purchase, error) {
	var out Purchase
	err := r.pool.QueryRow(ctx, `
		INSERT INTO pantrly_purchases (item_id, supplier_id, quantity, cost_cents, purchase_date, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, item_id, supplier_id, quantity, cost_cents, purchase_date::text, notes, created_at`,
		p.ItemID, p.SupplierID, p.Quantity, p.CostCents, p.PurchaseDate, p.Notes).Scan(
		&out.ID, &out.ItemID, &out.SupplierID, &out.Quantity, &out.CostCents, &out.PurchaseDate, &out.Notes, &out.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert purchase: %w", err)
	}
	return &out, nil
}

func (r *Repo) ListPurchases(ctx context.Context, itemID, from, to string) ([]Purchase, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, item_id, supplier_id, quantity, cost_cents, purchase_date::text, notes, created_at
		FROM pantrly_purchases
		WHERE purchase_date BETWEEN $1 AND $2 AND ($3 = '' OR item_id::text = $3)
		ORDER BY purchase_date DESC, created_at DESC`, from, to, itemID)
	if err != nil {
		return nil, fmt.Errorf("query purchases: %w", err)
	}
	defer rows.Close()

	var out []Purchase
	for rows.Next() {
		var p Purchase
		if err := rows.Scan(&p.ID, &p.ItemID, &p.SupplierID, &p.Quantity, &p.CostCents, &p.PurchaseDate, &p.Notes, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan purchase: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// ListPurchasesWithCost returns costed purchases (cost_cents IS NOT NULL)
// within [from, to], joined with their item's name — used by Ledgerly to
// fold Pantrly deliveries into its expense summary.
func (r *Repo) ListPurchasesWithCost(ctx context.Context, from, to string) ([]PurchaseWithItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT p.id, p.item_id, p.supplier_id, p.quantity, p.cost_cents, p.purchase_date::text, p.notes, p.created_at, i.name
		FROM pantrly_purchases p
		JOIN pantrly_items i ON i.id = p.item_id
		WHERE p.purchase_date BETWEEN $1 AND $2 AND p.cost_cents IS NOT NULL
		ORDER BY p.purchase_date DESC, p.created_at DESC`, from, to)
	if err != nil {
		return nil, fmt.Errorf("query costed purchases: %w", err)
	}
	defer rows.Close()

	var out []PurchaseWithItem
	for rows.Next() {
		var p PurchaseWithItem
		if err := rows.Scan(&p.ID, &p.ItemID, &p.SupplierID, &p.Quantity, &p.CostCents, &p.PurchaseDate, &p.Notes, &p.CreatedAt, &p.ItemName); err != nil {
			return nil, fmt.Errorf("scan costed purchase: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// Summary computes, for every active item, the current stock (latest
// logged quantity — closing preferred over opening — plus any purchases
// recorded since that log's date) and whether it's below par level.
func (r *Repo) Summary(ctx context.Context) ([]ItemStock, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT i.id, i.name, i.unit, i.par_level,
		       latest.log_date, latest.opening_qty, latest.closing_qty,
		       COALESCE(p.qty_since, 0)
		FROM pantrly_items i
		LEFT JOIN LATERAL (
			SELECT log_date::text AS log_date, opening_qty, closing_qty
			FROM pantrly_stock_logs
			WHERE item_id = i.id AND (opening_qty IS NOT NULL OR closing_qty IS NOT NULL)
			ORDER BY log_date DESC
			LIMIT 1
		) latest ON true
		LEFT JOIN LATERAL (
			SELECT COALESCE(SUM(quantity), 0) AS qty_since
			FROM pantrly_purchases
			WHERE item_id = i.id
			  AND purchase_date > COALESCE(latest.log_date::date, '1900-01-01'::date)
		) p ON true
		WHERE i.active = true
		ORDER BY i.name`)
	if err != nil {
		return nil, fmt.Errorf("query stock summary: %w", err)
	}
	defer rows.Close()

	var out []ItemStock
	for rows.Next() {
		var s ItemStock
		var lastLogDate *string
		var opening, closing *float64
		var qtySinceLog float64
		if err := rows.Scan(&s.ItemID, &s.ItemName, &s.Unit, &s.ParLevel, &lastLogDate, &opening, &closing, &qtySinceLog); err != nil {
			return nil, fmt.Errorf("scan stock summary: %w", err)
		}
		s.LastLogDate = lastLogDate

		var base float64
		if closing != nil {
			base = *closing
		} else if opening != nil {
			base = *opening
		}
		s.CurrentStock = base + qtySinceLog
		s.LowStock = s.CurrentStock < s.ParLevel
		out = append(out, s)
	}
	return out, rows.Err()
}

// RangeFigures returns, per item, the opening quantity logged on `from`,
// the closing quantity logged on `to`, and purchases within [from, to] —
// callers derive consumption as opening + purchased - closing when both
// endpoints are present.
func (r *Repo) RangeFigures(ctx context.Context, from, to string) (map[string]rangeFigures, error) {
	out := map[string]rangeFigures{}

	rows, err := r.pool.Query(ctx, `
		SELECT item_id, log_date::text, opening_qty, closing_qty
		FROM pantrly_stock_logs
		WHERE log_date IN ($1, $2)`, from, to)
	if err != nil {
		return nil, fmt.Errorf("query range logs: %w", err)
	}
	for rows.Next() {
		var itemID, logDate string
		var opening, closing *float64
		if err := rows.Scan(&itemID, &logDate, &opening, &closing); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan range log: %w", err)
		}
		fig := out[itemID]
		if logDate == from && opening != nil {
			fig.OpeningAtFrom = opening
		}
		if logDate == to && closing != nil {
			fig.ClosingAtTo = closing
		}
		out[itemID] = fig
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	prows, err := r.pool.Query(ctx, `
		SELECT item_id, COALESCE(SUM(quantity), 0)
		FROM pantrly_purchases
		WHERE purchase_date BETWEEN $1 AND $2
		GROUP BY item_id`, from, to)
	if err != nil {
		return nil, fmt.Errorf("query range purchases: %w", err)
	}
	defer prows.Close()
	for prows.Next() {
		var itemID string
		var purchased float64
		if err := prows.Scan(&itemID, &purchased); err != nil {
			return nil, fmt.Errorf("scan range purchase: %w", err)
		}
		fig := out[itemID]
		fig.Purchased = purchased
		out[itemID] = fig
	}
	return out, prows.Err()
}

type rangeFigures struct {
	OpeningAtFrom *float64
	ClosingAtTo   *float64
	Purchased     float64
}
