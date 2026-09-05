package advance

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
	advances, err := h.repo.List(r.Context(), q.Get("employee_id"), from, to)
	if err != nil {
		http.Error(w, "failed to list advances", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, advances)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	a, err := h.repo.Get(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to fetch advance", http.StatusInternalServerError)
		return
	}
	if a == nil {
		http.Error(w, "advance not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var a Advance
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := validateAdvance(a); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if a.AdvanceDate == "" {
		a.AdvanceDate = time.Now().Format("2006-01-02")
	}
	a.LoggedBy, _ = r.Context().Value(middleware.AdminIDKey).(string)

	created, err := h.repo.Create(r.Context(), a)
	if err != nil {
		http.Error(w, "failed to create advance", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var a Advance
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := validateAdvance(a); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	updated, err := h.repo.Update(r.Context(), id, a)
	if err != nil {
		http.Error(w, "failed to update advance", http.StatusInternalServerError)
		return
	}
	if updated == nil {
		http.Error(w, "advance not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ok, err := h.repo.Delete(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to delete advance", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "advance not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validateAdvance(a Advance) error {
	if a.EmployeeID == "" {
		return fmt.Errorf("employee_id is required")
	}
	if a.AmountCents <= 0 {
		return fmt.Errorf("amount_cents must be positive")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
