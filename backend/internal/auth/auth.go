package auth

import (
	"context"
	"errors"
	"fmt"
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
// email. If it already exists, it is left untouched.
func (s *Service) SeedWhitelistedEmail(ctx context.Context, email string) error {
	if email == "" {
		return nil
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO admins (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, email)
	if err != nil {
		return fmt.Errorf("seed whitelisted email: %w", err)
	}
	return nil
}

type Claims struct {
	AdminID string `json:"admin_id"`
	Email   string `json:"email"`
	jwt.RegisteredClaims
}

// LoginWithGoogle verifies a Google ID token, checks that the resulting
// email is whitelisted in the admins table, and returns a signed JWT valid
// for 24h.
func (s *Service) LoginWithGoogle(ctx context.Context, idToken string) (token, email string, err error) {
	claims, err := VerifyGoogleIDToken(ctx, idToken, s.googleClientID)
	if err != nil {
		return "", "", err
	}

	var id string
	dbErr := s.pool.QueryRow(ctx, `SELECT id FROM admins WHERE email = $1`, claims.Email).Scan(&id)
	if errors.Is(dbErr, pgx.ErrNoRows) {
		return "", "", ErrEmailNotWhitelisted
	}
	if dbErr != nil {
		return "", "", fmt.Errorf("query admin: %w", dbErr)
	}

	jwtClaims := Claims{
		AdminID: id,
		Email:   claims.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwtClaims).SignedString(s.secret)
	if err != nil {
		return "", "", fmt.Errorf("sign token: %w", err)
	}
	return signed, claims.Email, nil
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
