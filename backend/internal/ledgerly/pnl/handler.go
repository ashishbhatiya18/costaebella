package pnl

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"attendance-app/costaebella-backend/internal/ledgerly/payment"
	"attendance-app/costaebella-backend/internal/ledgerly/revenue"
	"attendance-app/costaebella-backend/internal/pantrly/stock"
	"attendance-app/costaebella-backend/internal/shiftly/advance"
	"attendance-app/costaebella-backend/internal/shiftly/attendance"
	"attendance-app/costaebella-backend/internal/shiftly/employee"
	"attendance-app/costaebella-backend/internal/shiftly/payout"
)

type Handler struct {
	revenue     *revenue.Repo
	payments    *payment.Repo
	stock       *stock.Repo
	advances    *advance.Repo
	employees   *employee.Repo
	attendances *attendance.Repo
}

func NewHandler(revenue *revenue.Repo, payments *payment.Repo, stock *stock.Repo, advances *advance.Repo, employees *employee.Repo, attendances *attendance.Repo) *Handler {
	return &Handler{revenue: revenue, payments: payments, stock: stock, advances: advances, employees: employees, attendances: attendances}
}

// period is one range's computed P&L, shared by the single-period Summary
// endpoint and the multi-period Trend endpoint.
type period struct {
	From              string                   `json:"from"`
	To                string                   `json:"to"`
	RevenueCents      int64                    `json:"revenue_cents"`
	RevenueCashCents  int64                    `json:"revenue_cash_cents"`
	RevenueCardCents  int64                    `json:"revenue_card_cents"`
	RevenueUpiCents   int64                    `json:"revenue_upi_cents"`
	RevenueOtherCents int64                    `json:"revenue_other_cents"`
	PaymentsCents     int64                    `json:"payments_cents"`
	PurchasesCents    int64                    `json:"purchases_cents"`
	AdvancesCents     int64                    `json:"advances_cents"`
	SalaryCents       int64                    `json:"salary_cents"`
	ExpensesCents     int64                    `json:"expenses_cents"`
	ProfitCents       int64                    `json:"profit_cents"`
	PantrlyPurchases  []stock.PurchaseWithItem `json:"pantrly_purchases"`
}

// compute derives one period's P&L for [from, to]. Salary is accrued labor
// cost — computed from attendance, not from any logged expense — clipped to
// "as of today" so a future-dated range (e.g. the rest of the current month)
// doesn't project unearned salary.
func (h *Handler) compute(ctx context.Context, from, to time.Time) (period, error) {
	fromStr, toStr := from.Format("2006-01-02"), to.Format("2006-01-02")

	revenueByMethod, err := h.revenue.RangeRevenueByMethod(ctx, fromStr, toStr)
	if err != nil {
		return period{}, err
	}
	var revenueCents int64
	for _, v := range revenueByMethod {
		revenueCents += v
	}

	paymentsCents, err := h.payments.RangeTotal(ctx, fromStr, toStr)
	if err != nil {
		return period{}, err
	}

	purchases, err := h.stock.ListPurchasesWithCost(ctx, fromStr, toStr)
	if err != nil {
		return period{}, err
	}
	var purchasesCents int64
	for _, p := range purchases {
		if p.CostCents != nil {
			purchasesCents += *p.CostCents
		}
	}

	advancesCents, err := h.advances.RangeTotal(ctx, fromStr, toStr)
	if err != nil {
		return period{}, err
	}

	today := time.Now().UTC()
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
	salaryTo := to
	if salaryTo.After(today) {
		salaryTo = today
	}
	var salaryCents int64
	if !salaryTo.Before(from) {
		salaryCents, err = payout.RangeLaborCostTotal(ctx, h.employees, h.attendances, from, salaryTo)
		if err != nil {
			return period{}, err
		}
	}

	expensesCents := paymentsCents + purchasesCents + advancesCents + salaryCents

	return period{
		From:              fromStr,
		To:                toStr,
		RevenueCents:      revenueCents,
		RevenueCashCents:  revenueByMethod["cash"],
		RevenueCardCents:  revenueByMethod["card"],
		RevenueUpiCents:   revenueByMethod["upi"],
		RevenueOtherCents: revenueByMethod["other"],
		PaymentsCents:     paymentsCents,
		PurchasesCents:    purchasesCents,
		AdvancesCents:     advancesCents,
		SalaryCents:       salaryCents,
		ExpensesCents:     expensesCents,
		ProfitCents:       revenueCents - expensesCents,
		PantrlyPurchases:  purchases,
	}, nil
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

	p, err := h.compute(r.Context(), from, to)
	if err != nil {
		http.Error(w, "failed to compute P&L summary", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"range":               rangeType,
		"from":                p.From,
		"to":                  p.To,
		"revenue_cents":       p.RevenueCents,
		"revenue_cash_cents":  p.RevenueCashCents,
		"revenue_card_cents":  p.RevenueCardCents,
		"revenue_upi_cents":   p.RevenueUpiCents,
		"revenue_other_cents": p.RevenueOtherCents,
		"payments_cents":      p.PaymentsCents,
		"purchases_cents":     p.PurchasesCents,
		"advances_cents":      p.AdvancesCents,
		"salary_cents":        p.SalaryCents,
		"expenses_cents":      p.ExpensesCents,
		"profit_cents":        p.ProfitCents,
		"pantrly_purchases":   p.PantrlyPurchases,
	})
}

// Trend handles GET /api/ledgerly/summary/pnl/trend?range=week|month&periods=N
// — returns the last N consecutive periods (oldest first, ending at the
// current one) of revenue/expenses/profit, for charting.
func (h *Handler) Trend(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	rangeType := q.Get("range")
	if rangeType == "" {
		rangeType = "week"
	}
	if rangeType != "week" && rangeType != "month" {
		http.Error(w, "range must be one of week, month", http.StatusBadRequest)
		return
	}

	periods := 8
	if pStr := q.Get("periods"); pStr != "" {
		parsed, err := strconv.Atoi(pStr)
		if err != nil || parsed < 1 {
			http.Error(w, "invalid periods, expected a positive integer", http.StatusBadRequest)
			return
		}
		periods = parsed
	}
	maxPeriods := 26
	if periods > maxPeriods {
		periods = maxPeriods
	}

	anchor := time.Now()
	out := make([]map[string]interface{}, 0, periods)
	for i := periods - 1; i >= 0; i-- {
		var periodAnchor time.Time
		if rangeType == "week" {
			periodAnchor = anchor.AddDate(0, 0, -7*i)
		} else {
			periodAnchor = anchor.AddDate(0, -i, 0)
		}
		from, to := rangeBounds(rangeType, periodAnchor)

		p, err := h.compute(r.Context(), from, to)
		if err != nil {
			http.Error(w, "failed to compute P&L trend", http.StatusInternalServerError)
			return
		}

		out = append(out, map[string]interface{}{
			"from":           p.From,
			"to":             p.To,
			"revenue_cents":  p.RevenueCents,
			"expenses_cents": p.ExpensesCents,
			"profit_cents":   p.ProfitCents,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"range":   rangeType,
		"periods": out,
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
