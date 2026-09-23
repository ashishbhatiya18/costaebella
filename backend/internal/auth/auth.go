package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrEmailNotWhitelisted = errors.New("email not whitelisted")

type Service struct {
	pool           *pgxpool.Pool
	secret         []byte
	googleClientID string
}

func NewService(pool *pgxpool.Pool, secret, googleClientID string) *Service {
	return &Service{pool: pool, secret: []byte(secret), googleClientID: googleClientID}
}

// SeedWhitelistedEmail ensures a whitelisted-admin row exists for the given
// email, as an owner (Accessly's top role). If it already exists, it is
// left untouched — this is only how the very first admin account is
// bootstrapped; every subsequent user is added through Accessly, not env
// vars.
func (s *Service) SeedWhitelistedEmail(ctx context.Context, email string) error {
	email = NormalizeEmail(email)
	if email == "" {
		return nil
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO admins (email, role) VALUES ($1, 'owner') ON CONFLICT (email) DO NOTHING`, email)
	if err != nil {
		return fmt.Errorf("seed whitelisted email: %w", err)
	}
	return nil
}

type Claims struct {
	AdminID string `json:"admin_id"`
	Email   string `json:"email"`
	// Role is the Accessly role (owner/operations/accounting) at the time
	// of login, empty if unassigned. It's carried in the token rather than
	// looked up per-request so role-gated routes (internal/accessly/access)
	// don't need a DB round trip — the trade-off is that a role change made
	// in Accessly only takes effect for a user the next time they sign in
	// (tokens are valid 24h), not immediately.
	Role string `json:"role"`
	jwt.RegisteredClaims
}

// LoginWithGoogle verifies a Google ID token, checks that the resulting
// email is whitelisted in the admins table, and returns a signed JWT valid
// for 24h.
func (s *Service) LoginWithGoogle(ctx context.Context, idToken string) (token, email, role string, err error) {
	claims, err := VerifyGoogleIDToken(ctx, idToken, s.googleClientID)
	if err != nil {
		return "", "", "", err
	}

	normalizedEmail := NormalizeEmail(claims.Email)
	var id string
	var dbRole *string
	dbErr := s.pool.QueryRow(ctx, `SELECT id, role FROM admins WHERE email = $1`, normalizedEmail).Scan(&id, &dbRole)
	if errors.Is(dbErr, pgx.ErrNoRows) {
		return "", "", "", ErrEmailNotWhitelisted
	}
	if dbErr != nil {
		return "", "", "", fmt.Errorf("query admin: %w", dbErr)
	}
	if dbRole != nil {
		role = *dbRole
	}

	jwtClaims := Claims{
		AdminID: id,
		Email:   normalizedEmail,
		Role:    role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwtClaims).SignedString(s.secret)
	if err != nil {
		return "", "", "", fmt.Errorf("sign token: %w", err)
	}
	return signed, normalizedEmail, role, nil
}

// Verify parses and validates a JWT, returning its claims.
func (s *Service) Verify(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	return claims, nil
}

// NormalizeEmail trims and lowercases an email so whitelist comparisons
// against the admins table aren't tripped up by incidental case/whitespace
// differences between how an email was seeded vs. how Google reports it.
// Exported so callers elsewhere (e.g. internal/accessly/user) apply the
// same normalization.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
