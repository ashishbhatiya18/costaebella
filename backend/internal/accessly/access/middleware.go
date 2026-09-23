package access

import (
	"net/http"

	"attendance-app/costaebella-backend/internal/accessly/user"
	"attendance-app/costaebella-backend/internal/middleware"
)

// RequireRole gates a route to admins whose JWT carries one of the given
// Accessly roles (read from context, stashed there by middleware.RequireAuth
// from the token's claims — see auth.Claims.Role for why this isn't a DB
// lookup). Used to restrict each app to the roles that make sense for it,
// e.g. Shiftly/Pantrly to owner+operations, Ledgerly to owner+accounting.
func RequireRole(allowed ...string) func(http.Handler) http.Handler {
	allowedSet := make(map[string]bool, len(allowed))
	for _, r := range allowed {
		allowedSet[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, _ := r.Context().Value(middleware.AdminRoleKey).(string)
			if !allowedSet[role] {
				http.Error(w, "not authorized for this app", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireOwner gates every Accessly route to the owner role — user
// management itself is owner-only, unlike most other apps' data-entry
// routes which are shared across whichever roles that app allows.
func RequireOwner() func(http.Handler) http.Handler {
	return RequireRole(user.RoleOwner)
}
