package revenue

type Sale struct {
	ID            string   `json:"id"`
	SaleDate      string   `json:"sale_date"`    // YYYY-MM-DD
	AmountCents   int64    `json:"amount_cents"` // amount actually received, after any discount
	PaymentMethod string   `json:"payment_method"`
	Notes         string   `json:"notes"`
	LoggedBy      string   `json:"logged_by"`
	ItemNames     []string `json:"item_names"` // menu items this sale was for, if tagged

	DiscountCents   int64  `json:"discount_cents"`   // bill total = amount_cents + discount_cents
	DiscountReason  string `json:"discount_reason"`  // why the discount / complimentary was given
	IsComplimentary bool   `json:"is_complimentary"` // free bill: amount is 0, dishes still count for stock
}

type SaleRequest struct {
	SaleDate      string   `json:"sale_date"` // YYYY-MM-DD, defaults to today if empty
	AmountCents   int64    `json:"amount_cents"`
	PaymentMethod string   `json:"payment_method"`
	Notes         string   `json:"notes"`
	ItemNames     []string `json:"item_names"`

	DiscountCents   int64  `json:"discount_cents"`
	DiscountReason  string `json:"discount_reason"`
	IsComplimentary bool   `json:"is_complimentary"`
}
