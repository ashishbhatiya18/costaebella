package user

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"attendance-app/costaebella-backend/internal/auth"
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

func (r *Repo) List(ctx context.Context) ([]User, error) {
	rows, err := r.pool.Query(ctx, `SELECT id, email, role, created_at FROM admins ORDER BY created_at`)
	if err != nil {
		return nil, fmt.Errorf("query users: %w", err)
	}
	defer rows.Close()

	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Role, &u.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (r *Repo) Get(ctx context.Context, id string) (*User, error) {
	var u User
	err := r.pool.QueryRow(ctx, `SELECT id, email, role, created_at FROM admins WHERE id = $1`, id).
		Scan(&u.ID, &u.Email, &u.Role, &u.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	return &u, nil
}

// Create whitelists a new email (granting it login access to all of
// /admin, same as every other admins row) with the given role bound.
func (r *Repo) Create(ctx context.Context, email, role string) (*User, error) {
	email = auth.NormalizeEmail(email)
	var id string
	err := r.pool.QueryRow(ctx, `INSERT INTO admins (email, role) VALUES ($1, $2) RETURNING id`, email, role).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("insert user: %w", err)
	}
	return r.Get(ctx, id)
}

// SetRole binds a user to a new role. The row itself, and therefore login
// access, is untouched — only Accessly-level role assignment changes.
func (r *Repo) SetRole(ctx context.Context, id, role string) (*User, error) {
	tag, err := r.pool.Exec(ctx, `UPDATE admins SET role = $1 WHERE id = $2`, role, id)
	if err != nil {
		return nil, fmt.Errorf("set role: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, nil
	}
	return r.Get(ctx, id)
}

// Delete removes a user's admin row entirely, revoking login access to
// every app behind /admin, not just their Accessly role.
func (r *Repo) Delete(ctx context.Context, id string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM admins WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("delete user: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// IsOwner reports whether the given admin id currently has the owner role
// — used to gate the whole of Accessly to owners only.
func (r *Repo) IsOwner(ctx context.Context, adminID string) (bool, error) {
	var role *string
	err := r.pool.QueryRow(ctx, `SELECT role FROM admins WHERE id = $1`, adminID).Scan(&role)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("check owner role: %w", err)
	}
	return role != nil && *role == RoleOwner, nil
}
