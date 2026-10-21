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
	req.DiscountReason = strings.TrimSpace(req.DiscountReason)
	if req.IsComplimentary {
		// A complimentary bill brings in nothing — it's logged only so its
		// dishes (and the stock they used) are accounted for.
		if req.DiscountReason == "" {
			http.Error(w, "a reason is required for a complimentary sale", http.StatusBadRequest)
			return
		}
		req.AmountCents = 0
		req.DiscountCents = 0
		req.PaymentMethod = ""
	} else {
		if req.AmountCents <= 0 {
			http.Error(w, "amount_cents must be positive", http.StatusBadRequest)
			return
		}
		if req.DiscountCents < 0 {
			http.Error(w, "discount_cents cannot be negative", http.StatusBadRequest)
			return
		}
		if req.DiscountCents > 0 && req.DiscountReason == "" {
			http.Error(w, "a reason is required when a discount is given", http.StatusBadRequest)
			return
		}
		if req.DiscountCents == 0 {
			req.DiscountReason = ""
		}
	}
	isGiveaway := req.IsComplimentary || req.DiscountCents > 0
	req.GivenTo, req.GivenToEmployeeID = normalizeRecipient(req.GivenTo, req.GivenToEmployeeID)
	if !isGiveaway {
		req.GivenTo, req.GivenToEmployeeID = "", nil
	} else if req.GivenTo == "" && req.GivenToEmployeeID == nil {
		http.Error(w, "say who the discount / complimentary was given to", http.StatusBadRequest)
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
		if errors.Is(err, errUnknownEmployee) {
			http.Error(w, "unknown employee", http.StatusBadRequest)
			return
		}
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

// UpdateRecipient handles PUT /api/ledgerly/revenue/sales/{id}/recipient —
// sets who a discount / complimentary bill was given to.
func (h *Handler) UpdateRecipient(w http.ResponseWriter, r *http.Request) {
	var req RecipientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	req.GivenTo, req.GivenToEmployeeID = normalizeRecipient(req.GivenTo, req.GivenToEmployeeID)
	if req.GivenTo == "" && req.GivenToEmployeeID == nil {
		http.Error(w, "given_to or given_to_employee_id is required", http.StatusBadRequest)
		return
	}
	s, err := h.repo.UpdateRecipient(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		switch {
		case errors.Is(err, errSaleNotFound):
			http.Error(w, "no discounted or complimentary sale with that id", http.StatusNotFound)
		case errors.Is(err, errUnknownEmployee):
			http.Error(w, "unknown employee", http.StatusBadRequest)
		default:
			http.Error(w, "failed to update recipient", http.StatusInternalServerError)
		}
		return
	}
	writeJSON(w, http.StatusOK, s)
}

// RecipientNames handles GET /api/ledgerly/revenue/recipients — past
// non-staff recipient names, for suggestions.
func (h *Handler) RecipientNames(w http.ResponseWriter, r *http.Request) {
	names, err := h.repo.RecipientNames(r.Context())
	if err != nil {
		http.Error(w, "failed to list recipients", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, names)
}

// normalizeRecipient trims the name and treats a blank employee id as none.
// A linked employee takes precedence: their name is filled in from Shiftly,
// so any typed name is dropped.
func normalizeRecipient(givenTo string, employeeID *string) (string, *string) {
	if employeeID != nil {
		if id := strings.TrimSpace(*employeeID); id != "" {
			return "", &id
		}
	}
	return strings.TrimSpace(givenTo), nil
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
