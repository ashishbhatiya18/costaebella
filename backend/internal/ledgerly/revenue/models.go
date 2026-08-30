package revenue

type DailyLog struct {
	ID        string `json:"id"`
	LogDate   string `json:"log_date"` // YYYY-MM-DD
	CashCents int64  `json:"cash_cents"`
	CardCents int64  `json:"card_cents"`
	UpiCents  int64  `json:"upi_cents"`
	Notes     string `json:"notes"`
	LoggedBy  string `json:"logged_by"`
}

type DailyLogRequest struct {
	Date      string `json:"date"` // YYYY-MM-DD, defaults to today if empty
	CashCents int64  `json:"cash_cents"`
	CardCents int64  `json:"card_cents"`
	UpiCents  int64  `json:"upi_cents"`
	Notes     string `json:"notes"`
}

type Sale struct {
	ID            string `json:"id"`
	SaleDate      string `json:"sale_date"` // YYYY-MM-DD
	AmountCents   int64  `json:"amount_cents"`
	PaymentMethod string `json:"payment_method"`
	Notes         string `json:"notes"`
	LoggedBy      string `json:"logged_by"`
}

type SaleRequest struct {
	SaleDate      string `json:"sale_date"` // YYYY-MM-DD, defaults to today if empty
	AmountCents   int64  `json:"amount_cents"`
	PaymentMethod string `json:"payment_method"`
	Notes         string `json:"notes"`
}
