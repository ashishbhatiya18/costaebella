package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"attendance-app/costaebella-backend/internal/attendance"
	"attendance-app/costaebella-backend/internal/auth"
	"attendance-app/costaebella-backend/internal/config"
	"attendance-app/costaebella-backend/internal/db"
	"attendance-app/costaebella-backend/internal/employee"
	"attendance-app/costaebella-backend/internal/middleware"
	"attendance-app/costaebella-backend/internal/payout"
	"attendance-app/costaebella-backend/internal/reconcile"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect failed: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	authSvc := auth.NewService(pool, cfg.JWTSecret, cfg.GoogleClientID)
	if err := authSvc.SeedWhitelistedEmail(ctx, cfg.AdminEmail); err != nil {
		log.Fatalf("admin whitelist seed failed: %v", err)
	}

	employeeRepo := employee.NewRepo(pool)
	attendanceRepo := attendance.NewRepo(pool)

	authHandler := auth.NewHandler(authSvc)
	employeeHandler := employee.NewHandler(employeeRepo)
	attendanceHandler := attendance.NewHandler(attendanceRepo)
	payoutHandler := payout.NewHandler(employeeRepo, attendanceRepo)

	r := chi.NewRouter()
	r.Use(middleware.Logging)
	r.Use(middleware.CORS(cfg.AllowedOrigins))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	r.Post("/api/auth/google", authHandler.GoogleLogin)

	r.Group(func(pr chi.Router) {
		pr.Use(middleware.RequireAuth(authSvc))

		pr.Route("/api/employees", func(er chi.Router) {
			er.Get("/", employeeHandler.List)
			er.Post("/", employeeHandler.Create)
			er.Get("/{id}", employeeHandler.Get)
			er.Put("/{id}", employeeHandler.Update)
			er.Delete("/{id}", employeeHandler.Delete)
		})

		pr.Post("/api/attendance/log", attendanceHandler.Log)
		pr.Put("/api/attendance/override", attendanceHandler.Override)
		pr.Get("/api/attendance", attendanceHandler.List)
		pr.Get("/api/attendance/activity", attendanceHandler.Activity)

		pr.Get("/api/summary/attendance", payoutHandler.AttendanceSummary)
		pr.Get("/api/summary/payout", payoutHandler.PayoutSummary)
	})

	go reconcile.Run(ctx, employeeRepo, attendanceRepo, 5*time.Minute)

	log.Printf("listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
