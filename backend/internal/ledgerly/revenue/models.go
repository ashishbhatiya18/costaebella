package revenue

type Sale struct {
	ID            string   `json:"id"`
	SaleDate      string   `json:"sale_date"` // YYYY-MM-DD
	AmountCents   int64    `json:"amount_cents"`
	PaymentMethod string   `json:"payment_method"`
	Notes         string   `json:"notes"`
	LoggedBy      string   `json:"logged_by"`
	ItemNames     []string `json:"item_names"` // menu items this sale was for, if tagged
}

type SaleRequest struct {
	SaleDate      string   `json:"sale_date"` // YYYY-MM-DD, defaults to today if empty
	AmountCents   int64    `json:"amount_cents"`
	PaymentMethod string   `json:"payment_method"`
	Notes         string   `json:"notes"`
	ItemNames     []string `json:"item_names"`
}
