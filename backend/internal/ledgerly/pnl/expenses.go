package pnl

import (
	"net/http"
	"strconv"
	"time"
)

// expenseMonth is one month of the Expense Trends view. Every figure comes
// from the same compute() the P&L Summary uses, but the view is cash-based:
// salary is what was actually paid out, so attendance-accrued (earned) salary
// is left out and ExpensesCents is P&L's expenses_cents minus that accrual.
type expenseMonth struct {
	From         string `json:"from"`
	To           string `json:"to"`
	RevenueCents int64  `json:"revenue_cents"`

	// Grocery = Pantrly costed deliveries + ledgerly_payments of category
	// supplier_purchase. P&L counts both (they're independent records with
	// no link between them), so both sub-lines are exposed to let the user
	// spot a delivery logged in both places.
	GroceryCents                 int64 `json:"grocery_cents"`
	GroceryPantrlyCents          int64 `json:"grocery_pantrly_cents"`
	GrocerySupplierPaymentsCents int64 `json:"grocery_supplier_payments_cents"`

	// Salary = every salary payment made in the month: ledgerly_payments of
	// category salary plus Shiftly advances, with both sub-lines exposed.
	SalaryCents         int64 `json:"salary_cents"`
	SalaryPaymentsCents int64 `json:"salary_payments_cents"`
	AdvancesCents       int64 `json:"advances_cents"`

	// PaymentsByCategory is every ledgerly_payments category with a nonzero
	// total in the month (including salary and supplier_purchase, which are
	// also surfaced above).
	PaymentsByCategory map[string]int64 `json:"payments_by_category"`
	PaymentsCents      int64            `json:"payments_cents"`

	ExpensesCents int64 `json:"expenses_cents"`
	ProfitCents   int64 `json:"profit_cents"`
}

const (
	defaultExpenseTrendPeriods = 6
	maxExpenseTrendPeriods     = 24
)

// ExpenseTrend handles
// GET /api/ledgerly/summary/expenses/trend?periods=N&anchor_date=YYYY-MM-DD
// — N consecutive calendar months (oldest first) ending at the month
// containing anchor_date (default today). Computed on read, nothing stored.
func (h *Handler) ExpenseTrend(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	periods := defaultExpenseTrendPeriods
	if pStr := q.Get("periods"); pStr != "" {
		parsed, err := strconv.Atoi(pStr)
		if err != nil || parsed < 1 {
			http.Error(w, "invalid periods, expected a positive integer", http.StatusBadRequest)
			return
		}
		periods = parsed
	}
	if periods > maxExpenseTrendPeriods {
		periods = maxExpenseTrendPeriods
	}

	anchor := time.Now().UTC()
	if a := q.Get("anchor_date"); a != "" {
		parsed, err := time.Parse("2006-01-02", a)
		if err != nil {
			http.Error(w, "invalid anchor_date, expected YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		anchor = parsed
	}

	months := make([]expenseMonth, 0, periods)
	for i := periods - 1; i >= 0; i-- {
		// time.Date normalises a negative/overflowing month, and pinning
		// day=1 avoids AddDate's end-of-month rollover (e.g. Mar 31 - 1mo).
		from := time.Date(anchor.Year(), anchor.Month()-time.Month(i), 1, 0, 0, 0, 0, time.UTC)
		to := from.AddDate(0, 1, -1)

		p, err := h.compute(r.Context(), from, to)
		if err != nil {
			http.Error(w, "failed to compute expense trend", http.StatusInternalServerError)
			return
		}

		supplierPayments := p.PaymentsByCategory["supplier_purchase"]
		salaryPayments := p.PaymentsByCategory["salary"]
		// Drop accrued salary so only money actually paid out is counted.
		expensesCents := p.ExpensesCents - p.SalaryCents
		months = append(months, expenseMonth{
			From:                         p.From,
			To:                           p.To,
			RevenueCents:                 p.RevenueCents,
			GroceryCents:                 p.PurchasesCents + supplierPayments,
			GroceryPantrlyCents:          p.PurchasesCents,
			GrocerySupplierPaymentsCents: supplierPayments,
			SalaryCents:                  salaryPayments + p.AdvancesCents,
			SalaryPaymentsCents:          salaryPayments,
			AdvancesCents:                p.AdvancesCents,
			PaymentsByCategory:           p.PaymentsByCategory,
			PaymentsCents:                p.PaymentsCents,
			ExpensesCents:                expensesCents,
			ProfitCents:                  p.RevenueCents - expensesCents,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"anchor_date": anchor.Format("2006-01-02"),
		"periods":     periods,
		"months":      months,
	})
}
