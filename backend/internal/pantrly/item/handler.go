package item

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
	items, err := h.repo.List(r.Context())
	if err != nil {
		http.Error(w, "failed to list items", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	it, err := h.repo.Get(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to fetch item", http.StatusInternalServerError)
		return
	}
	if it == nil {
		http.Error(w, "item not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, it)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var it Item
	if err := json.NewDecoder(r.Body).Decode(&it); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := validateItem(it); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	it.Active = true
	created, err := h.repo.Create(r.Context(), it)
	if err != nil {
		http.Error(w, "failed to create item", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var it Item
	if err := json.NewDecoder(r.Body).Decode(&it); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := validateItem(it); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	updated, err := h.repo.Update(r.Context(), id, it)
	if err != nil {
		http.Error(w, "failed to update item", http.StatusInternalServerError)
		return
	}
	if updated == nil {
		http.Error(w, "item not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ok, err := h.repo.Delete(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to delete item", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "item not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validateItem(it Item) error {
	if strings.TrimSpace(it.Name) == "" {
		return fmt.Errorf("name is required")
	}
	if strings.TrimSpace(it.Unit) == "" {
		return fmt.Errorf("unit is required")
	}
	if it.ParLevel < 0 {
		return fmt.Errorf("par_level must not be negative")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
