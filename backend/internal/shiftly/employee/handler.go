package employee

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	employees, err := h.repo.List(r.Context())
	if err != nil {
		http.Error(w, "failed to list employees", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, employees)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	e, err := h.repo.Get(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to fetch employee", http.StatusInternalServerError)
		return
	}
	if e == nil {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, e)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var e Employee
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := validateEmployee(e); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	e.Active = true
	created, err := h.repo.Create(r.Context(), e)
	if err != nil {
		http.Error(w, "failed to create employee", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var e Employee
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := validateEmployee(e); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	updated, err := h.repo.Update(r.Context(), id, e)
	if err != nil {
		http.Error(w, "failed to update employee", http.StatusInternalServerError)
		return
	}
	if updated == nil {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ok, err := h.repo.Delete(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to delete employee", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// validateEmployee checks basic invariants for the hourly payout model.
func validateEmployee(e Employee) error {
	if strings.TrimSpace(e.Name) == "" {
		return fmt.Errorf("name is required")
	}
	if _, err := time.Parse("2006-01-02", e.StartDate); err != nil {
		return fmt.Errorf("start_date must be a valid date (YYYY-MM-DD)")
	}
	if len(e.WeeklyOffDays) > 7 {
		return fmt.Errorf("weekly_off_days cannot list more than 7 days")
	}
	seen := map[int]bool{}
	for _, d := range e.WeeklyOffDays {
		if d < 0 || d > 6 {
			return fmt.Errorf("weekly_off_days must each be between 0 (Sunday) and 6 (Saturday)")
		}
		if seen[d] {
			return fmt.Errorf("weekly_off_days contains a duplicate day")
		}
		seen[d] = true
	}
	if e.EligibleHoursPerDay <= 0 || e.EligibleHoursPerDay > 24 {
		return fmt.Errorf("eligible_hours_per_day must be greater than 0 and at most 24")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
