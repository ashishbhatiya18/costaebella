package payout

import (
	"encoding/json"
	"net/http"
	"time"

	"attendance-app/costaebella-backend/internal/attendance"
	"attendance-app/costaebella-backend/internal/employee"
)

type Handler struct {
	employees   *employee.Repo
	attendances *attendance.Repo
}

func NewHandler(employees *employee.Repo, attendances *attendance.Repo) *Handler {
	return &Handler{employees: employees, attendances: attendances}
}

// AttendanceSummary handles GET /api/summary/attendance?range=week|month|quarter&anchor_date=YYYY-MM-DD
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

// PayoutSummary handles GET /api/summary/payout?month=YYYY-MM
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

	results := make([]EmployeePayout, 0, len(employees))
	for _, e := range employees {
		results = append(results, ComputePayout(e, logs, monthStart, monthEnd))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"month":     monthStart.Format("2006-01"),
		"employees": results,
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
