package composition

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

const selectEntries = `
	SELECT c.id, c.item_name, c.pantrly_item_id, i.name, i.unit, c.quantity_per_order, c.updated_at
	FROM menuly_item_composition c
	JOIN pantrly_items i ON i.id = c.pantrly_item_id`

// ListForItem returns the recipe for one dish.
func (r *Repo) ListForItem(ctx context.Context, itemName string) ([]Entry, error) {
	rows, err := r.pool.Query(ctx, selectEntries+` WHERE c.item_name = $1 ORDER BY i.name`, itemName)
	if err != nil {
		return nil, fmt.Errorf("query composition: %w", err)
	}
	defer rows.Close()
	return scanEntries(rows)
}

// ListAll returns every dish's recipe — used to compute expected
// consumption across every tagged sale in a date range at once.
func (r *Repo) ListAll(ctx context.Context) ([]Entry, error) {
	rows, err := r.pool.Query(ctx, selectEntries+` ORDER BY c.item_name, i.name`)
	if err != nil {
		return nil, fmt.Errorf("query all composition: %w", err)
	}
	defer rows.Close()
	return scanEntries(rows)
}

func scanEntries(rows interface {
	Next() bool
	Scan(...interface{}) error
	Err() error
}) ([]Entry, error) {
	out := []Entry{}
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.ID, &e.ItemName, &e.PantrlyItemID, &e.PantrlyItemName, &e.PantrlyUnit, &e.QuantityPerOrder, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan composition entry: %w", err)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// Set upserts one recipe line (item_name, pantrly_item_id) with a new
// quantity_per_order.
func (r *Repo) Set(ctx context.Context, req SetEntryRequest) (*Entry, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO menuly_item_composition (item_name, pantrly_item_id, quantity_per_order)
		VALUES ($1, $2, $3)
		ON CONFLICT (item_name, pantrly_item_id) DO UPDATE SET quantity_per_order = $3, updated_at = now()
		RETURNING id`,
		req.ItemName, req.PantrlyItemID, req.QuantityPerOrder).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("upsert composition entry: %w", err)
	}

	var e Entry
	err = r.pool.QueryRow(ctx, selectEntries+` WHERE c.id = $1`, id).Scan(
		&e.ID, &e.ItemName, &e.PantrlyItemID, &e.PantrlyItemName, &e.PantrlyUnit, &e.QuantityPerOrder, &e.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("fetch composition entry: %w", err)
	}
	return &e, nil
}

func (r *Repo) Delete(ctx context.Context, id string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM menuly_item_composition WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("delete composition entry: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}
