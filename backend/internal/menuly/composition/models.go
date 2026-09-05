package composition

import "time"

// Entry is one line of a dish's recipe: how much of one Pantrly item one
// order of the dish consumes. PantrlyItemName/PantrlyUnit are joined in for
// display convenience — the row of record is keyed by PantrlyItemID.
type Entry struct {
	ID               string    `json:"id"`
	ItemName         string    `json:"item_name"`
	PantrlyItemID    string    `json:"pantrly_item_id"`
	PantrlyItemName  string    `json:"pantrly_item_name"`
	PantrlyUnit      string    `json:"pantrly_unit"`
	QuantityPerOrder float64   `json:"quantity_per_order"`
	UpdatedAt        time.Time `json:"updated_at,omitempty"`
}

type SetEntryRequest struct {
	ItemName         string  `json:"item_name"`
	PantrlyItemID    string  `json:"pantrly_item_id"`
	QuantityPerOrder float64 `json:"quantity_per_order"`
}
