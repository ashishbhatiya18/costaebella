package payment

import "time"

type Payment struct {
	ID            string    `json:"id"`
	Category      string    `json:"category"` // see ValidCategories
	AmountCents   int64     `json:"amount_cents"`
	PaymentDate   string    `json:"payment_date"` // YYYY-MM-DD
	PaymentMethod string    `json:"payment_method"`
	Payee         string    `json:"payee"`
	EmployeeID    *string   `json:"employee_id"`
	SupplierID    *string   `json:"supplier_id"`
	Notes         string    `json:"notes"`
	LoggedBy      string    `json:"logged_by"`
	CreatedAt     time.Time `json:"created_at,omitempty"`
}

var ValidCategories = map[string]bool{
	"rent":              true,
	"utilities":         true,
	"supplier_purchase": true,
	"salary":            true,
	"maintenance":       true,
	"marketing":         true,
	"licenses_fees":     true,
	"transport":         true,
	"equipment":         true,
	"other":             true,
}
