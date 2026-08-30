package payment

import (
	"encoding/json"
	"fmt"
	"net/http"
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

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	from, to := q.Get("from"), q.Get("to")
	if from == "" || to == "" {
		http.Error(w, "from and to query params are required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}
	payments, err := h.repo.List(r.Context(), q.Get("category"), from, to)
	if err != nil {
		http.Error(w, "failed to list payments", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, payments)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	p, err := h.repo.Get(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to fetch payment", http.StatusInternalServerError)
		return
	}
	if p == nil {
		http.Error(w, "payment not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var p Payment
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := validatePayment(p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if p.PaymentDate == "" {
		p.PaymentDate = time.Now().Format("2006-01-02")
	}
	p.LoggedBy, _ = r.Context().Value(middleware.AdminIDKey).(string)

	created, err := h.repo.Create(r.Context(), p)
	if err != nil {
		http.Error(w, "failed to create payment", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var p Payment
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := validatePayment(p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	updated, err := h.repo.Update(r.Context(), id, p)
	if err != nil {
		http.Error(w, "failed to update payment", http.StatusInternalServerError)
		return
	}
	if updated == nil {
		http.Error(w, "payment not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ok, err := h.repo.Delete(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to delete payment", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "payment not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validatePayment(p Payment) error {
	if !ValidCategories[p.Category] {
		return fmt.Errorf("category must be one of: rent, utilities, supplier_purchase, salary, maintenance, marketing, licenses_fees, transport, equipment, other")
	}
	if p.AmountCents <= 0 {
		return fmt.Errorf("amount_cents must be positive")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
