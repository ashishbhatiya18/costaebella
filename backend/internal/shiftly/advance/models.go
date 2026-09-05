package advance

import "time"

type Advance struct {
	ID          string    `json:"id"`
	EmployeeID  string    `json:"employee_id"`
	AmountCents int64     `json:"amount_cents"`
	AdvanceDate string    `json:"advance_date"` // YYYY-MM-DD
	Notes       string    `json:"notes"`
	LoggedBy    string    `json:"logged_by"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
}
