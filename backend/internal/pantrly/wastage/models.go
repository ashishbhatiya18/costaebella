package wastage

import "time"

type WastageLog struct {
	ID          string    `json:"id"`
	ItemID      string    `json:"item_id"`
	Quantity    float64   `json:"quantity"`
	Reason      string    `json:"reason"`
	WastageDate string    `json:"wastage_date"` // YYYY-MM-DD
	LoggedBy    string    `json:"logged_by"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
}

type WastageRequest struct {
	ItemID      string  `json:"item_id"`
	Quantity    float64 `json:"quantity"`
	Reason      string  `json:"reason"`
	WastageDate string  `json:"wastage_date"` // YYYY-MM-DD, defaults to today if empty
}

// WastageWithItem is a wastage log joined with its item's name — used for
// display without duplicating item lookups on the caller's side.
type WastageWithItem struct {
	WastageLog
	ItemName string `json:"item_name"`
	Unit     string `json:"unit"`
}
