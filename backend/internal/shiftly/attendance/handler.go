package attendance

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Log(w http.ResponseWriter, r *http.Request) {
	var req LogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.EmployeeID == "" {
		http.Error(w, "employee_id is required", http.StatusBadRequest)
		return
	}
	if req.Field != "login" && req.Field != "logout" {
		http.Error(w, "field must be 'login' or 'logout'", http.StatusBadRequest)
		return
	}

	date := req.Date
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	ts := time.Now()
	if req.Time != nil && *req.Time != "" {
		parsed, err := time.Parse(time.RFC3339, *req.Time)
		if err != nil {
			http.Error(w, fmt.Sprintf("invalid time format, expected RFC3339: %v", err), http.StatusBadRequest)
			return
		}
		ts = parsed
	}

	var log *Log
	var err error
	if req.Field == "login" {
		log, err = h.repo.InsertSession(r.Context(), req.EmployeeID, date, ts)
	} else {
		log, err = h.repo.CloseOpenSession(r.Context(), req.EmployeeID, date, ts)
		if errors.Is(err, ErrNoOpenSession) {
			http.Error(w, "no open session to log out from", http.StatusConflict)
			return
		}
	}
	if err != nil {
		http.Error(w, "failed to log attendance", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(log)
}

// Override handles PUT /api/shiftly/attendance/override — an admin correction that
// replaces all attendance for an employee+date with either a set of
// sessions or a leave marker.
func (h *Handler) Override(w http.ResponseWriter, r *http.Request) {
	var req OverrideRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.EmployeeID == "" || req.Date == "" {
		http.Error(w, "employee_id and date are required", http.StatusBadRequest)
		return
	}
	if err := validateSessions(req.Sessions); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	logs, err := h.repo.ReplaceDay(r.Context(), req.EmployeeID, req.Date, req.Sessions, req.IsLeave, req.IsCompOff, req.IsWeeklyOff)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to override attendance: %v", err), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

// maxSessionHours caps any single manually-entered session so a mis-typed
// date/month (e.g. logout accidentally logged a month after login) can't
// silently inflate hours-worked/payout by hundreds of hours.
const maxSessionHours = 24.0

// validateSessions rejects any override session whose login-to-logout span
// exceeds maxSessionHours.
func validateSessions(sessions []SessionInput) error {
	for _, s := range sessions {
		if s.LogoutTime == nil {
			continue
		}
		login, err := time.Parse(time.RFC3339, s.LoginTime)
		if err != nil {
			return fmt.Errorf("invalid login_time format, expected RFC3339: %v", err)
		}
		logout, err := time.Parse(time.RFC3339, *s.LogoutTime)
		if err != nil {
			return fmt.Errorf("invalid logout_time format, expected RFC3339: %v", err)
		}
		if logout.Sub(login).Hours() > maxSessionHours {
			return fmt.Errorf("session %s to %s exceeds the %gh maximum — check the date/time", s.LoginTime, *s.LogoutTime, maxSessionHours)
		}
	}
	return nil
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	employeeID := q.Get("employee_id")
	from := q.Get("from")
	to := q.Get("to")
	if from == "" || to == "" {
		http.Error(w, "from and to query params are required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}

	logs, err := h.repo.ListRange(r.Context(), employeeID, from, to)
	if err != nil {
		http.Error(w, "failed to list attendance", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

// Activity handles GET /api/shiftly/attendance/activity?employee_id=&limit=&offset=
func (h *Handler) Activity(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	employeeID := q.Get("employee_id")

	limit := 10
	if v := q.Get("limit"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed <= 0 {
			http.Error(w, "limit must be a positive integer", http.StatusBadRequest)
			return
		}
		limit = parsed
	}

	offset := 0
	if v := q.Get("offset"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed < 0 {
			http.Error(w, "offset must be a non-negative integer", http.StatusBadRequest)
			return
		}
		offset = parsed
	}

	items, hasMore, err := h.repo.RecentActivity(r.Context(), employeeID, limit, offset)
	if err != nil {
		http.Error(w, "failed to load recent activity", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"items":    items,
		"has_more": hasMore,
	})
}
