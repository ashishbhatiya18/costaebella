package revenue

import (
	"encoding/json"
	"net/http"
	"time"

	"attendance-app/costaebella-backend/internal/middleware"
)

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

// LogDaily handles POST /api/ledgerly/revenue/log — upserts the end-of-day
// cash/card/UPI total for a date.
func (h *Handler) LogDaily(w http.ResponseWriter, r *http.Request) {
	var req DailyLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.CashCents < 0 || req.CardCents < 0 || req.UpiCents < 0 {
		http.Error(w, "amounts must not be negative", http.StatusBadRequest)
		return
	}
	date := req.Date
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	loggedBy, _ := r.Context().Value(middleware.AdminIDKey).(string)
	l, err := h.repo.UpsertDailyLog(r.Context(), date, req, loggedBy)
	if err != nil {
		http.Error(w, "failed to log daily revenue", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, l)
}

// ListDaily handles GET /api/ledgerly/revenue?from=&to=
func (h *Handler) ListDaily(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	from, to := q.Get("from"), q.Get("to")
	if from == "" || to == "" {
		http.Error(w, "from and to query params are required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}
	logs, err := h.repo.ListDailyLogs(r.Context(), from, to)
	if err != nil {
		http.Error(w, "failed to list daily revenue logs", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, logs)
}

// LogSale handles POST /api/ledgerly/revenue/sales — records one per-sale entry.
func (h *Handler) LogSale(w http.ResponseWriter, r *http.Request) {
	var req SaleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.AmountCents <= 0 {
		http.Error(w, "amount_cents must be positive", http.StatusBadRequest)
		return
	}
	if req.SaleDate == "" {
		req.SaleDate = time.Now().Format("2006-01-02")
	}

	loggedBy, _ := r.Context().Value(middleware.AdminIDKey).(string)
	s, err := h.repo.InsertSale(r.Context(), req, loggedBy)
	if err != nil {
		http.Error(w, "failed to log sale", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, s)
}

// ListSales handles GET /api/ledgerly/revenue/sales?from=&to=
func (h *Handler) ListSales(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	from, to := q.Get("from"), q.Get("to")
	if from == "" || to == "" {
		http.Error(w, "from and to query params are required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}
	sales, err := h.repo.ListSales(r.Context(), from, to)
	if err != nil {
		http.Error(w, "failed to list sales", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, sales)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
