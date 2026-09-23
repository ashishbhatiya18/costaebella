package user

import "time"

const (
	RoleOwner      = "owner"
	RoleOperations = "operations"
	RoleAccounting = "accounting"
)

// ValidRoles are the only roles Accessly can bind a user to. Keep the
// frontend's ROLE_OPTIONS/ROLE_LABELS in sync if this set changes.
var ValidRoles = map[string]bool{
	RoleOwner:      true,
	RoleOperations: true,
	RoleAccounting: true,
}

// User is a row in the admins table — the same table every app's login
// whitelist and RequireAuth check against. Role is nullable: a NULL role
// means the account can still log in (it's whitelisted) but has no
// Accessly-assigned role until an owner binds one.
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Role      *string   `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}
