package wastage

import (
	"encoding/json"
	"net/http"
	"time"

	"attendance-app/costaebella-backend/internal/middleware"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

// Log handles POST /api/pantrly/wastage — records an item lost to spoilage
// or similar wastage, distinct from a delivery (which adds stock) or a
// stock-count log (which records what's on hand).
func (h *Handler) Log(w http.ResponseWriter, r *http.Request) {
	var req WastageRequest
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
	if req.WastageDate == "" {
		req.WastageDate = time.Now().Format("2006-01-02")
	}

	loggedBy, _ := r.Context().Value(middleware.AdminIDKey).(string)

	log, err := h.repo.Insert(r.Context(), req, loggedBy)
	if err != nil {
		http.Error(w, "failed to log wastage", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, log)
}

// List handles GET /api/pantrly/wastage?item_id=&from=&to=
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	from, to := q.Get("from"), q.Get("to")
	if from == "" || to == "" {
		http.Error(w, "from and to query params are required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}
	logs, err := h.repo.List(r.Context(), q.Get("item_id"), from, to)
	if err != nil {
		http.Error(w, "failed to list wastage logs", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, logs)
}

// Delete handles DELETE /api/pantrly/wastage/{id}
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ok, err := h.repo.Delete(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to delete wastage log", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "wastage log not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
