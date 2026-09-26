package revenue

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"attendance-app/costaebella-backend/internal/middleware"
)

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
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
	var itemNames []string
	for _, name := range req.ItemNames {
		if trimmed := strings.TrimSpace(name); trimmed != "" {
			itemNames = append(itemNames, trimmed)
		}
	}
	if len(itemNames) == 0 {
		http.Error(w, "at least one item_name is required", http.StatusBadRequest)
		return
	}
	req.ItemNames = itemNames
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

// DeleteSale handles DELETE /api/ledgerly/revenue/sales/{id}
func (h *Handler) DeleteSale(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.DeleteSale(r.Context(), id); err != nil {
		if errors.Is(err, errSaleNotFound) {
			http.Error(w, "sale not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to delete sale", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
