package payout

import (
	"encoding/json"
	"net/http"
	"sort"
	"time"

	"attendance-app/costaebella-backend/internal/shiftly/advance"
	"attendance-app/costaebella-backend/internal/shiftly/attendance"
	"attendance-app/costaebella-backend/internal/shiftly/employee"
)

type Handler struct {
	employees   *employee.Repo
	attendances *attendance.Repo
	advances    *advance.Repo
}

func NewHandler(employees *employee.Repo, attendances *attendance.Repo, advances *advance.Repo) *Handler {
	return &Handler{employees: employees, attendances: attendances, advances: advances}
}

// AttendanceSummary handles GET /api/shiftly/summary/attendance?range=week|month|quarter&anchor_date=YYYY-MM-DD
func (h *Handler) AttendanceSummary(w http.ResponseWriter, r *http.Request) {
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
		http.Error(w, "range must be one of week, month, quarter", http.StatusBadRequest)
		return
	}

	employees, err := h.employees.List(r.Context())
	if err != nil {
		http.Error(w, "failed to load employees", http.StatusInternalServerError)
		return
	}
	logs, err := h.attendances.ListRange(r.Context(), "", from.Format("2006-01-02"), to.Format("2006-01-02"))
	if err != nil {
		http.Error(w, "failed to load attendance", http.StatusInternalServerError)
		return
	}

	results := make([]EmployeeAvailability, 0, len(employees))
	for _, e := range employees {
		results = append(results, ComputeAvailability(e, logs, from, to))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"range":     rangeType,
		"from":      from.Format("2006-01-02"),
		"to":        to.Format("2006-01-02"),
		"employees": results,
	})
}

// PayoutSummary handles GET /api/shiftly/summary/payout?month=YYYY-MM
func (h *Handler) PayoutSummary(w http.ResponseWriter, r *http.Request) {
	monthParam := r.URL.Query().Get("month")
	anchor := time.Now()
	if monthParam != "" {
		parsed, err := time.Parse("2006-01", monthParam)
		if err != nil {
			http.Error(w, "invalid month, expected YYYY-MM", http.StatusBadRequest)
			return
		}
		anchor = parsed
	}

	monthStart := time.Date(anchor.Year(), anchor.Month(), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := monthStart.AddDate(0, 1, -1)

	employees, err := h.employees.List(r.Context())
	if err != nil {
		http.Error(w, "failed to load employees", http.StatusInternalServerError)
		return
	}
	logs, err := h.attendances.ListRange(r.Context(), "", monthStart.Format("2006-01-02"), monthEnd.Format("2006-01-02"))
	if err != nil {
		http.Error(w, "failed to load attendance", http.StatusInternalServerError)
		return
	}
	advanceTotals, err := h.advances.RangeTotalsByEmployee(r.Context(), monthStart.Format("2006-01-02"), monthEnd.Format("2006-01-02"))
	if err != nil {
		http.Error(w, "failed to load advances", http.StatusInternalServerError)
		return
	}

	results := make([]EmployeePayout, 0, len(employees))
	for _, e := range employees {
		results = append(results, ComputePayout(e, logs, monthStart, monthEnd, advanceTotals[e.ID]))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"month":     monthStart.Format("2006-01"),
		"employees": results,
	})
}

// LaborCostSummary handles GET /api/shiftly/summary/labor-cost?from=&to=
// Returns total gross labor cost per day across all employees for an
// arbitrary [from, to] — used by Intel-ly to correlate staffing cost
// against revenue on the same range, which doesn't have to align to a
// calendar month the way PayoutSummary does. Internally runs the same
// ComputePayout used for the real payout run (so day-level costs stay
// consistent with prorated-leave/permitted-leave logic) once per month the
// range touches, then clips each employee's DailyCosts to the requested
// window and sums across employees. Advances are intentionally not netted
// here — this is gross labor cost, not "what's left to pay out".
func (h *Handler) LaborCostSummary(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	fromStr, toStr := q.Get("from"), q.Get("to")
	if fromStr == "" || toStr == "" {
		http.Error(w, "from and to query params are required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}
	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		http.Error(w, "invalid from, expected YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		http.Error(w, "invalid to, expected YYYY-MM-DD", http.StatusBadRequest)
		return
	}

	employees, err := h.employees.List(r.Context())
	if err != nil {
		http.Error(w, "failed to load employees", http.StatusInternalServerError)
		return
	}

	// Irregular categories: any employee-day short of a normal full
	// presence (or an expected weekly off). Used by Intel-ly to flag days
	// where staffing deviated from standard operational timings and
	// correlate that against revenue.
	isIrregular := map[string]bool{
		CategoryHalfDay:     true,
		CategoryAbsent:      true,
		CategoryLeave:       true,
		CategoryUnpaidLeave: true,
	}

	type dayAgg struct {
		costCents        int64
		irregularCount   int
		employeeDayCount int
	}
	totals := map[string]*dayAgg{}
	for monthStart := time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, time.UTC); !monthStart.After(to); monthStart = monthStart.AddDate(0, 1, 0) {
		monthEnd := monthStart.AddDate(0, 1, -1)

		logs, err := h.attendances.ListRange(r.Context(), "", monthStart.Format("2006-01-02"), monthEnd.Format("2006-01-02"))
		if err != nil {
			http.Error(w, "failed to load attendance", http.StatusInternalServerError)
			return
		}

		for _, e := range employees {
			payout := ComputePayout(e, logs, monthStart, monthEnd, 0)
			for _, dc := range payout.DailyCosts {
				d, err := time.Parse("2006-01-02", dc.Date)
				if err != nil || d.Before(from) || d.After(to) {
					continue
				}
				if dc.Category == CategoryBeforeStart {
					continue
				}
				agg, ok := totals[dc.Date]
				if !ok {
					agg = &dayAgg{}
					totals[dc.Date] = agg
				}
				agg.costCents += dc.CostCents
				agg.employeeDayCount++
				if isIrregular[dc.Category] {
					agg.irregularCount++
				}
			}
		}
	}

	dates := make([]string, 0, len(totals))
	for date := range totals {
		dates = append(dates, date)
	}
	sort.Strings(dates)
	days := make([]map[string]interface{}, 0, len(dates))
	for _, date := range dates {
		agg := totals[date]
		days = append(days, map[string]interface{}{
			"date":               date,
			"cost_cents":         agg.costCents,
			"irregular_count":    agg.irregularCount,
			"employee_day_count": agg.employeeDayCount,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"from": fromStr,
		"to":   toStr,
		"days": days,
	})
}

func rangeBounds(rangeType string, anchor time.Time) (time.Time, time.Time) {
	anchor = time.Date(anchor.Year(), anchor.Month(), anchor.Day(), 0, 0, 0, 0, time.UTC)
	switch rangeType {
	case "week":
		// Week starts Monday.
		offset := (int(anchor.Weekday()) + 6) % 7
		start := anchor.AddDate(0, 0, -offset)
		return start, start.AddDate(0, 0, 6)
	case "month":
		start := time.Date(anchor.Year(), anchor.Month(), 1, 0, 0, 0, 0, time.UTC)
		return start, start.AddDate(0, 1, -1)
	case "quarter":
		q := (int(anchor.Month()) - 1) / 3
		startMonth := time.Month(q*3 + 1)
		start := time.Date(anchor.Year(), startMonth, 1, 0, 0, 0, 0, time.UTC)
		return start, start.AddDate(0, 3, -1)
	default:
		return time.Time{}, time.Time{}
	}
}
