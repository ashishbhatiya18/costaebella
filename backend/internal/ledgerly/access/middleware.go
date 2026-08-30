package access

import (
	"net/http"

	"attendance-app/costaebella-backend/internal/middleware"
)

// RequireLedgerlyAdmin gates a route behind the narrower Ledgerly whitelist,
// on top of the already-applied RequireAuth. Only the P&L summary route
// uses this — every other Ledgerly route (revenue, payments) is reachable
// by any admin, same as Shiftly/Pantrly.
func RequireLedgerlyAdmin(repo *Repo) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			email, _ := r.Context().Value(middleware.AdminEmailKey).(string)
			ok, err := repo.IsWhitelisted(r.Context(), email)
			if err != nil {
				http.Error(w, "failed to check ledgerly access", http.StatusInternalServerError)
				return
			}
			if !ok {
				http.Error(w, "not authorized for ledgerly summary", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
