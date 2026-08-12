package auth

import (
	"encoding/json"
	"errors"
	"net/http"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

type googleLoginRequest struct {
	Credential string `json:"credential"`
}

type loginResponse struct {
	Token string `json:"token"`
	Email string `json:"email"`
}

// GoogleLogin exchanges a Google ID token for a session JWT, provided the
// token's email is present in the admins whitelist table.
func (h *Handler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	var req googleLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Credential == "" {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	token, email, err := h.svc.LoginWithGoogle(r.Context(), req.Credential)
	if errors.Is(err, ErrEmailNotWhitelisted) {
		http.Error(w, "this email is not authorized to sign in", http.StatusForbidden)
		return
	}
	if errors.Is(err, ErrInvalidGoogleToken) {
		http.Error(w, "invalid google credential", http.StatusUnauthorized)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(loginResponse{Token: token, Email: email})
}
