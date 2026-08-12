package config

import (
	"os"
	"strings"
)

type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	AdminEmail     string
	GoogleClientID string
	AllowedOrigins []string
}

func Load() Config {
	origins := os.Getenv("ALLOWED_ORIGINS")
	if origins == "" {
		origins = "http://localhost:3000"
	}

	return Config{
		Port:           getenv("PORT", "8080"),
		DatabaseURL:    getenv("DATABASE_URL", "postgres://attendance:attendance@localhost:5432/attendance?sslmode=disable"),
		JWTSecret:      getenv("JWT_SECRET", "dev-secret-change-me"),
		AdminEmail:     getenv("ADMIN_EMAIL", ""),
		GoogleClientID: getenv("GOOGLE_CLIENT_ID", ""),
		AllowedOrigins: strings.Split(origins, ","),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
