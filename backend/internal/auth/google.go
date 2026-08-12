package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const googleCertsURL = "https://www.googleapis.com/oauth2/v3/certs"
const googleIssuerPrefix1 = "accounts.google.com"
const googleIssuerPrefix2 = "https://accounts.google.com"

var ErrInvalidGoogleToken = errors.New("invalid google id token")

// googleKeySet caches Google's JWKS so we don't fetch it on every login.
type googleKeySet struct {
	mu      sync.Mutex
	keys    map[string]*rsa.PublicKey
	fetched time.Time
}

var keySet = &googleKeySet{}

type jwk struct {
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwksResponse struct {
	Keys []jwk `json:"keys"`
}

func (s *googleKeySet) get(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if key, ok := s.keys[kid]; ok && time.Since(s.fetched) < time.Hour {
		return key, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleCertsURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch google certs: %w", err)
	}
	defer resp.Body.Close()

	var parsed jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("decode google certs: %w", err)
	}

	keys := make(map[string]*rsa.PublicKey, len(parsed.Keys))
	for _, k := range parsed.Keys {
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		n := new(big.Int).SetBytes(nBytes)
		e := new(big.Int).SetBytes(eBytes)
		keys[k.Kid] = &rsa.PublicKey{N: n, E: int(e.Int64())}
	}

	s.keys = keys
	s.fetched = time.Now()

	key, ok := keys[kid]
	if !ok {
		return nil, fmt.Errorf("no matching google key for kid %q", kid)
	}
	return key, nil
}

// GoogleClaims are the claims we care about from a verified Google ID token.
type GoogleClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	jwt.RegisteredClaims
}

// VerifyGoogleIDToken validates a Google-issued ID token's signature, issuer,
// audience and expiry, and returns its claims.
func VerifyGoogleIDToken(ctx context.Context, idToken, clientID string) (*GoogleClaims, error) {
	claims := &GoogleClaims{}

	token, err := jwt.ParseWithClaims(idToken, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("missing kid header")
		}
		return keySet.get(ctx, kid)
	}, jwt.WithValidMethods([]string{"RS256"}))
	_ = token

	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidGoogleToken, err)
	}

	if claims.Audience == nil || !containsAudience(claims.Audience, clientID) {
		return nil, fmt.Errorf("%w: audience mismatch", ErrInvalidGoogleToken)
	}
	issuer := claims.Issuer
	if issuer != googleIssuerPrefix1 && issuer != googleIssuerPrefix2 {
		return nil, fmt.Errorf("%w: issuer mismatch", ErrInvalidGoogleToken)
	}
	if !claims.EmailVerified || claims.Email == "" {
		return nil, fmt.Errorf("%w: email not verified", ErrInvalidGoogleToken)
	}

	return claims, nil
}

func containsAudience(aud jwt.ClaimStrings, clientID string) bool {
	for _, a := range aud {
		if a == clientID {
			return true
		}
	}
	return false
}
