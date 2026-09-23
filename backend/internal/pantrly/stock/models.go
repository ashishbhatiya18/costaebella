package stock

import "time"

type StockLog struct {
	ID         string   `json:"id"`
	ItemID     string   `json:"item_id"`
	LogDate    string   `json:"log_date"` // YYYY-MM-DD
	OpeningQty *float64 `json:"opening_qty"`
	ClosingQty *float64 `json:"closing_qty"`
	LoggedBy   string   `json:"logged_by"`
}

type LogRequest struct {
	ItemID   string  `json:"item_id"`
	Date     string  `json:"date"`  // YYYY-MM-DD, defaults to today if empty
	Field    string  `json:"field"` // "opening" or "closing"
	Quantity float64 `json:"quantity"`
}

type Purchase struct {
	ID           string    `json:"id"`
	ItemID       string    `json:"item_id"`
	SupplierID   *string   `json:"supplier_id"`
	Quantity     float64   `json:"quantity"`
	CostCents    *int64    `json:"cost_cents"`
	PurchaseDate string    `json:"purchase_date"` // YYYY-MM-DD
	Notes        string    `json:"notes"`
	CreatedAt    time.Time `json:"created_at,omitempty"`
}

type PurchaseRequest struct {
	ItemID       string  `json:"item_id"`
	SupplierID   *string `json:"supplier_id"`
	Quantity     float64 `json:"quantity"`
	CostCents    *int64  `json:"cost_cents"`
	PurchaseDate string  `json:"purchase_date"` // YYYY-MM-DD, defaults to today if empty
	Notes        string  `json:"notes"`
}

// PurchaseWithItem is a purchase joined with its item's name — used by
// Ledgerly to fold costed Pantrly deliveries into its expense summary
// without duplicating item lookups on the caller's side.
type PurchaseWithItem struct {
	Purchase
	ItemName string `json:"item_name"`
}

// ItemStock is the computed current-stock/low-stock view for one item:
// the latest logged quantity (closing preferred over opening) plus any
// purchases recorded since that log's date.
type ItemStock struct {
	ItemID          string   `json:"item_id"`
	ItemName        string   `json:"item_name"`
	Unit            string   `json:"unit"`
	ParLevel        float64  `json:"par_level"`
	CurrentStock    float64  `json:"current_stock"`
	LowStock        bool     `json:"low_stock"`
	LastLogDate     *string  `json:"last_log_date"`
	ConsumedInRange *float64 `json:"consumed_in_range"`
	// RangeDays is how many days ConsumedInRange actually spans — the
	// anchor start may be later than the requested `from` if the item's
	// logging history doesn't go back that far yet, so callers averaging
	// per week/day should divide by this rather than the requested range.
	RangeDays *int `json:"range_days"`
}
