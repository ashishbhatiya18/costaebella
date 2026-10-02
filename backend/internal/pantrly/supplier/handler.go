package supplier

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	suppliers, err := h.repo.List(r.Context())
	if err != nil {
		http.Error(w, "failed to list suppliers", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, suppliers)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := h.repo.Get(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to fetch supplier", http.StatusInternalServerError)
		return
	}
	if s == nil {
		http.Error(w, "supplier not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var s Supplier
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := validateSupplier(s); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.Active = true
	created, err := h.repo.Create(r.Context(), s)
	if err != nil {
		http.Error(w, "failed to create supplier", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

// supplierUpdate is Update's request body: a full Supplier, except that
// is_emergency is optional — a client that doesn't know about the field
// (an older edit form) leaves it unchanged instead of resetting it to false.
type supplierUpdate struct {
	Supplier
	IsEmergency *bool `json:"is_emergency"`
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req supplierUpdate
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	s := req.Supplier
	if err := validateSupplier(s); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.IsEmergency != nil {
		s.IsEmergency = *req.IsEmergency
	} else {
		existing, err := h.repo.Get(r.Context(), id)
		if err != nil {
			http.Error(w, "failed to update supplier", http.StatusInternalServerError)
			return
		}
		if existing == nil {
			http.Error(w, "supplier not found", http.StatusNotFound)
			return
		}
		s.IsEmergency = existing.IsEmergency
	}
	updated, err := h.repo.Update(r.Context(), id, s)
	if err != nil {
		http.Error(w, "failed to update supplier", http.StatusInternalServerError)
		return
	}
	if updated == nil {
		http.Error(w, "supplier not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ok, err := h.repo.Delete(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to delete supplier", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "supplier not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListItems handles GET /api/pantrly/suppliers/{id}/items — the items
// linked to this supplier, used to compute order recommendations.
func (h *Handler) ListItems(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	items, err := h.repo.ListItems(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to list supplier items", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func validateSupplier(s Supplier) error {
	if strings.TrimSpace(s.Name) == "" {
		return fmt.Errorf("name is required")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
