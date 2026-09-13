package supplier

import (
	"context"
	"fmt"
)

// Item is the item-side view of a supplier link — just enough to compute
// an order recommendation (par level vs. current stock, which is fetched
// separately from stock.Repo.Summary) without importing the item package.
type Item struct {
	ItemID   string  `json:"item_id"`
	Name     string  `json:"name"`
	Unit     string  `json:"unit"`
	ParLevel float64 `json:"par_level"`
}

func (r *Repo) ListItems(ctx context.Context, supplierID string) ([]Item, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT i.id, i.name, i.unit, i.par_level
		FROM pantrly_item_suppliers link
		JOIN pantrly_items i ON i.id = link.item_id
		WHERE link.supplier_id = $1
		ORDER BY i.name`, supplierID)
	if err != nil {
		return nil, fmt.Errorf("query supplier items: %w", err)
	}
	defer rows.Close()

	var out []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ItemID, &it.Name, &it.Unit, &it.ParLevel); err != nil {
			return nil, fmt.Errorf("scan supplier item: %w", err)
		}
		out = append(out, it)
	}
	return out, rows.Err()
}
