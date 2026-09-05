package visibility

import (
	"encoding/json"
	"net/http"

	"attendance-app/costaebella-backend/internal/middleware"
)

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

// List handles GET /api/menuly/visibility (admin) — every currently hidden item name.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	hidden, err := h.repo.ListHidden(r.Context())
	if err != nil {
		http.Error(w, "failed to list hidden items", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"hidden_items": hidden})
}

// Set handles PUT /api/menuly/visibility (admin) — hides or unhides one item.
func (h *Handler) Set(w http.ResponseWriter, r *http.Request) {
	var req SetVisibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.ItemName == "" {
		http.Error(w, "item_name is required", http.StatusBadRequest)
		return
	}
	updatedBy, _ := r.Context().Value(middleware.AdminIDKey).(string)
	if err := h.repo.SetHidden(r.Context(), req.ItemName, req.Hidden, updatedBy); err != nil {
		http.Error(w, "failed to update visibility", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PublicList handles GET /api/menuly/visibility/public — no auth required.
// The public marketing site polls this to hide 86'd items without a
// full rebuild/redeploy of the static export.
func (h *Handler) PublicList(w http.ResponseWriter, r *http.Request) {
	hidden, err := h.repo.ListHidden(r.Context())
	if err != nil {
		http.Error(w, "failed to list hidden items", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"hidden_items": hidden})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
