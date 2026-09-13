package item

import (
	"context"
	"fmt"
)

// ItemSupplier is a supplier linked to an item — a "who supplies this"
// association distinct from a recorded delivery (pantrly_purchases), which
// tracks an actual received quantity/cost.
type ItemSupplier struct {
	SupplierID string `json:"supplier_id"`
	Name       string `json:"name"`
	Phone      string `json:"phone"`
}

func (r *Repo) AddSupplier(ctx context.Context, itemID, supplierID string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO pantrly_item_suppliers (item_id, supplier_id)
		VALUES ($1, $2)
		ON CONFLICT (item_id, supplier_id) DO NOTHING`, itemID, supplierID)
	if err != nil {
		return fmt.Errorf("link item supplier: %w", err)
	}
	return nil
}

func (r *Repo) ListSuppliers(ctx context.Context, itemID string) ([]ItemSupplier, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT s.id, s.name, s.phone
		FROM pantrly_item_suppliers link
		JOIN pantrly_suppliers s ON s.id = link.supplier_id
		WHERE link.item_id = $1
		ORDER BY s.name`, itemID)
	if err != nil {
		return nil, fmt.Errorf("query item suppliers: %w", err)
	}
	defer rows.Close()

	var out []ItemSupplier
	for rows.Next() {
		var s ItemSupplier
		if err := rows.Scan(&s.SupplierID, &s.Name, &s.Phone); err != nil {
			return nil, fmt.Errorf("scan item supplier: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Repo) RemoveSupplier(ctx context.Context, itemID, supplierID string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM pantrly_item_suppliers WHERE item_id = $1 AND supplier_id = $2`, itemID, supplierID)
	if err != nil {
		return false, fmt.Errorf("unlink item supplier: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}
