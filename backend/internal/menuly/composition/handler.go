package composition

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

// List handles GET /api/menuly/composition?item_name=... — the recipe for
// one dish, or every dish's recipe if item_name is omitted (used by
// Menuly's consumption reconciliation, which needs the full matrix at once).
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	itemName := r.URL.Query().Get("item_name")
	var (
		entries []Entry
		err     error
	)
	if itemName == "" {
		entries, err = h.repo.ListAll(r.Context())
	} else {
		entries, err = h.repo.ListForItem(r.Context(), itemName)
	}
	if err != nil {
		http.Error(w, "failed to list composition", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

// Set handles PUT /api/menuly/composition — upserts one recipe line.
func (h *Handler) Set(w http.ResponseWriter, r *http.Request) {
	var req SetEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.ItemName == "" || req.PantrlyItemID == "" {
		http.Error(w, "item_name and pantrly_item_id are required", http.StatusBadRequest)
		return
	}
	if req.QuantityPerOrder <= 0 {
		http.Error(w, "quantity_per_order must be positive", http.StatusBadRequest)
		return
	}
	entry, err := h.repo.Set(r.Context(), req)
	if err != nil {
		http.Error(w, "failed to save composition entry", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, entry)
}

// Delete handles DELETE /api/menuly/composition/{id} — removes one recipe line.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ok, err := h.repo.Delete(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to delete composition entry", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "composition entry not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
