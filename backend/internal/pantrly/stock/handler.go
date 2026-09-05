package stock

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

// Log handles POST /api/pantrly/stock/log — upserts an opening or closing
// quantity for an item on a given date.
func (h *Handler) Log(w http.ResponseWriter, r *http.Request) {
	var req LogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.ItemID == "" {
		http.Error(w, "item_id is required", http.StatusBadRequest)
		return
	}
	if req.Field != "opening" && req.Field != "closing" {
		http.Error(w, "field must be 'opening' or 'closing'", http.StatusBadRequest)
		return
	}
	if req.Quantity < 0 {
		http.Error(w, "quantity must not be negative", http.StatusBadRequest)
		return
	}

	date := req.Date
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	loggedBy, _ := r.Context().Value(middleware.AdminIDKey).(string)

	log, err := h.repo.UpsertLog(r.Context(), req.ItemID, date, req.Field, req.Quantity, loggedBy)
	if err != nil {
		http.Error(w, "failed to log stock", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, log)
}

// ListLogs handles GET /api/pantrly/stock?from=&to=&item_id=
func (h *Handler) ListLogs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	from, to := q.Get("from"), q.Get("to")
	if from == "" || to == "" {
		http.Error(w, "from and to query params are required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}
	logs, err := h.repo.ListLogs(r.Context(), q.Get("item_id"), from, to)
	if err != nil {
		http.Error(w, "failed to list stock logs", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, logs)
}

// RecordPurchase handles POST /api/pantrly/purchases — logs a delivery
// received from a (typically offline) supplier, increasing stock.
func (h *Handler) RecordPurchase(w http.ResponseWriter, r *http.Request) {
	var req PurchaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.ItemID == "" {
		http.Error(w, "item_id is required", http.StatusBadRequest)
		return
	}
	if req.Quantity <= 0 {
		http.Error(w, "quantity must be positive", http.StatusBadRequest)
		return
	}
	if req.CostCents != nil && *req.CostCents < 0 {
		http.Error(w, "cost_cents must not be negative", http.StatusBadRequest)
		return
	}
	if req.PurchaseDate == "" {
		req.PurchaseDate = time.Now().Format("2006-01-02")
	}

	p, err := h.repo.InsertPurchase(r.Context(), req)
	if err != nil {
		http.Error(w, "failed to record purchase", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

// ListPurchases handles GET /api/pantrly/purchases?item_id=&from=&to=
func (h *Handler) ListPurchases(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	from, to := q.Get("from"), q.Get("to")
	if from == "" || to == "" {
		http.Error(w, "from and to query params are required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}
	purchases, err := h.repo.ListPurchases(r.Context(), q.Get("item_id"), from, to)
	if err != nil {
		http.Error(w, "failed to list purchases", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, purchases)
}

// Summary handles GET /api/pantrly/summary/stock?range=week|month&anchor_date=YYYY-MM-DD
// or GET /api/pantrly/summary/stock?from=YYYY-MM-DD&to=YYYY-MM-DD (the
// latter lets callers like Menuly's consumption reconciliation align to an
// arbitrary date range instead of a fixed week/month bucket). Returns
// computed current stock and low-stock flags for every item, plus
// consumption over the requested range where both range endpoints have a
// logged count.
func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	var from, to time.Time
	rangeType := q.Get("range")
	if fromStr, toStr := q.Get("from"), q.Get("to"); fromStr != "" && toStr != "" {
		var err error
		from, err = time.Parse("2006-01-02", fromStr)
		if err != nil {
			http.Error(w, "invalid from, expected YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		to, err = time.Parse("2006-01-02", toStr)
		if err != nil {
			http.Error(w, "invalid to, expected YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		rangeType = "custom"
	} else {
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
		from, to = rangeBounds(rangeType, anchor)
		if from.IsZero() {
			http.Error(w, "range must be one of week, month", http.StatusBadRequest)
			return
		}
	}

	items, err := h.repo.Summary(r.Context())
	if err != nil {
		http.Error(w, "failed to compute stock summary", http.StatusInternalServerError)
		return
	}

	figures, err := h.repo.RangeFigures(r.Context(), from.Format("2006-01-02"), to.Format("2006-01-02"))
	if err != nil {
		http.Error(w, "failed to compute range figures", http.StatusInternalServerError)
		return
	}

	for i := range items {
		fig, ok := figures[items[i].ItemID]
		if !ok || fig.OpeningAtFrom == nil || fig.ClosingAtTo == nil {
			continue
		}
		consumed := *fig.OpeningAtFrom + fig.Purchased - *fig.ClosingAtTo
		items[i].ConsumedInRange = &consumed
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"range": rangeType,
		"from":  from.Format("2006-01-02"),
		"to":    to.Format("2006-01-02"),
		"items": items,
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
