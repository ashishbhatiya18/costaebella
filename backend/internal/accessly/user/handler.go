package user

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"attendance-app/costaebella-backend/internal/auth"
	"attendance-app/costaebella-backend/internal/middleware"
)

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.List(r.Context())
	if err != nil {
		http.Error(w, "failed to list users", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, users)
}

type createRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	email := auth.NormalizeEmail(req.Email)
	if email == "" {
		http.Error(w, "email is required", http.StatusBadRequest)
		return
	}
	if !ValidRoles[req.Role] {
		http.Error(w, "role must be one of owner, operations, accounting", http.StatusBadRequest)
		return
	}

	created, err := h.repo.Create(r.Context(), email, req.Role)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			http.Error(w, "a user with this email already exists", http.StatusConflict)
			return
		}
		http.Error(w, "failed to create user", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

type roleRequest struct {
	Role string `json:"role"`
}

// UpdateRole binds a user to a new role (owner/operations/accounting).
func (h *Handler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req roleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if !ValidRoles[req.Role] {
		http.Error(w, "role must be one of owner, operations, accounting", http.StatusBadRequest)
		return
	}

	updated, err := h.repo.SetRole(r.Context(), id, req.Role)
	if err != nil {
		http.Error(w, "failed to update role", http.StatusInternalServerError)
		return
	}
	if updated == nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// Delete removes a user entirely. Refuses to let the caller delete their
// own account so an owner can't accidentally lock themselves out.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if callerID, _ := r.Context().Value(middleware.AdminIDKey).(string); callerID == id {
		http.Error(w, "cannot delete your own account", http.StatusBadRequest)
		return
	}

	ok, err := h.repo.Delete(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to delete user", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
