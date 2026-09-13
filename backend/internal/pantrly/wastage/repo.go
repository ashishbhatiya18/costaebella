package wastage

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

func (r *Repo) Insert(ctx context.Context, req WastageRequest, loggedBy string) (*WastageLog, error) {
	var out WastageLog
	err := r.pool.QueryRow(ctx, `
		INSERT INTO pantrly_wastage_logs (item_id, quantity, reason, wastage_date, logged_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, item_id, quantity, reason, wastage_date::text, logged_by, created_at`,
		req.ItemID, req.Quantity, req.Reason, req.WastageDate, loggedBy).Scan(
		&out.ID, &out.ItemID, &out.Quantity, &out.Reason, &out.WastageDate, &out.LoggedBy, &out.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert wastage log: %w", err)
	}
	return &out, nil
}

func (r *Repo) List(ctx context.Context, itemID, from, to string) ([]WastageWithItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT w.id, w.item_id, w.quantity, w.reason, w.wastage_date::text, w.logged_by, w.created_at, i.name, i.unit
		FROM pantrly_wastage_logs w
		JOIN pantrly_items i ON i.id = w.item_id
		WHERE w.wastage_date BETWEEN $1 AND $2 AND ($3 = '' OR w.item_id::text = $3)
		ORDER BY w.wastage_date DESC, w.created_at DESC`, from, to, itemID)
	if err != nil {
		return nil, fmt.Errorf("query wastage logs: %w", err)
	}
	defer rows.Close()

	var out []WastageWithItem
	for rows.Next() {
		var w WastageWithItem
		if err := rows.Scan(&w.ID, &w.ItemID, &w.Quantity, &w.Reason, &w.WastageDate, &w.LoggedBy, &w.CreatedAt, &w.ItemName, &w.Unit); err != nil {
			return nil, fmt.Errorf("scan wastage log: %w", err)
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

func (r *Repo) Delete(ctx context.Context, id string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM pantrly_wastage_logs WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("delete wastage log: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}
