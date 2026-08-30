package pnl

import (
	"encoding/json"
	"net/http"
	"time"

	"attendance-app/costaebella-backend/internal/ledgerly/payment"
	"attendance-app/costaebella-backend/internal/ledgerly/revenue"
	"attendance-app/costaebella-backend/internal/pantrly/stock"
)

type Handler struct {
	revenue  *revenue.Repo
	payments *payment.Repo
	stock    *stock.Repo
}

func NewHandler(revenue *revenue.Repo, payments *payment.Repo, stock *stock.Repo) *Handler {
	return &Handler{revenue: revenue, payments: payments, stock: stock}
}

// Summary handles GET /api/ledgerly/summary/pnl?range=week|month&anchor_date=YYYY-MM-DD
func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	rangeType := q.Get("range")
	if rangeType == "" {
		rangeType = "week"
	}
	anchor := time.Now()
	if a := q.Get("anchor_date"); a != "" {
		parsed, err := time.Parse("2006-01-02", a)
		if err != nil {
			http.Error(w, "invalid anchor_date, expected YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		anchor = parsed
	}

	from, to := rangeBounds(rangeType, anchor)
	if from.IsZero() {
		http.Error(w, "range must be one of week, month", http.StatusBadRequest)
		return
	}
	fromStr, toStr := from.Format("2006-01-02"), to.Format("2006-01-02")

	revenueCents, err := h.revenue.RangeRevenue(r.Context(), fromStr, toStr)
	if err != nil {
		http.Error(w, "failed to compute revenue", http.StatusInternalServerError)
		return
	}

	paymentsCents, err := h.payments.RangeTotal(r.Context(), fromStr, toStr)
	if err != nil {
		http.Error(w, "failed to compute payments total", http.StatusInternalServerError)
		return
	}

	purchases, err := h.stock.ListPurchasesWithCost(r.Context(), fromStr, toStr)
	if err != nil {
		http.Error(w, "failed to load pantrly purchase costs", http.StatusInternalServerError)
		return
	}
	var purchasesCents int64
	for _, p := range purchases {
		if p.CostCents != nil {
			purchasesCents += *p.CostCents
		}
	}

	expensesCents := paymentsCents + purchasesCents

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"range":             rangeType,
		"from":              fromStr,
		"to":                toStr,
		"revenue_cents":     revenueCents,
		"payments_cents":    paymentsCents,
		"purchases_cents":   purchasesCents,
		"expenses_cents":    expensesCents,
		"profit_cents":      revenueCents - expensesCents,
		"pantrly_purchases": purchases,
	})
}

func rangeBounds(rangeType string, anchor time.Time) (time.Time, time.Time) {
	anchor = time.Date(anchor.Year(), anchor.Month(), anchor.Day(), 0, 0, 0, 0, time.UTC)
	switch rangeType {
	case "week":
		offset := (int(anchor.Weekday()) + 6) % 7
		start := anchor.AddDate(0, 0, -offset)
		return start, start.AddDate(0, 0, 6)
	case "month":
		start := time.Date(anchor.Year(), anchor.Month(), 1, 0, 0, 0, 0, time.UTC)
		return start, start.AddDate(0, 1, -1)
	default:
		return time.Time{}, time.Time{}
	}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
