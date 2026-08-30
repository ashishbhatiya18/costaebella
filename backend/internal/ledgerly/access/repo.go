package access

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

// SeedWhitelistedEmails ensures a ledgerly_admins row exists for each given
// email, mirroring auth.Service.SeedWhitelistedEmail for the main admins
// whitelist. Already-present emails are left untouched.
func (r *Repo) SeedWhitelistedEmails(ctx context.Context, emails []string) error {
	for _, email := range emails {
		email = auth.NormalizeEmail(email)
		if email == "" {
			continue
		}
		if _, err := r.pool.Exec(ctx, `INSERT INTO ledgerly_admins (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, email); err != nil {
			return fmt.Errorf("seed ledgerly admin %s: %w", email, err)
		}
	}
	return nil
}

// IsWhitelisted reports whether the given email has Ledgerly access.
func (r *Repo) IsWhitelisted(ctx context.Context, email string) (bool, error) {
	email = auth.NormalizeEmail(email)
	if email == "" {
		return false, nil
	}
	var id string
	err := r.pool.QueryRow(ctx, `SELECT id FROM ledgerly_admins WHERE email = $1`, email).Scan(&id)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("check ledgerly whitelist: %w", err)
	}
	return true, nil
}
