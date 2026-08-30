package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"attendance-app/costaebella-backend/internal/auth"
	"attendance-app/costaebella-backend/internal/config"
	"attendance-app/costaebella-backend/internal/db"
	"attendance-app/costaebella-backend/internal/ledgerly/access"
	"attendance-app/costaebella-backend/internal/ledgerly/payment"
	"attendance-app/costaebella-backend/internal/ledgerly/pnl"
	"attendance-app/costaebella-backend/internal/ledgerly/revenue"
	"attendance-app/costaebella-backend/internal/middleware"
	"attendance-app/costaebella-backend/internal/pantrly/item"
	"attendance-app/costaebella-backend/internal/pantrly/stock"
	"attendance-app/costaebella-backend/internal/pantrly/supplier"
	"attendance-app/costaebella-backend/internal/shiftly/attendance"
	"attendance-app/costaebella-backend/internal/shiftly/employee"
	"attendance-app/costaebella-backend/internal/shiftly/payout"
	"attendance-app/costaebella-backend/internal/shiftly/reconcile"
)

func main() {
	cfg := config.Load()
	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET is not set — refusing to start with no signing secret (anyone could forge admin tokens)")
	}
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

	ledgerlyAccessRepo := access.NewRepo(pool)
	if err := ledgerlyAccessRepo.SeedWhitelistedEmails(ctx, cfg.LedgerlyAdminEmails); err != nil {
		log.Fatalf("ledgerly whitelist seed failed: %v", err)
	}

	employeeRepo := employee.NewRepo(pool)
	attendanceRepo := attendance.NewRepo(pool)
	itemRepo := item.NewRepo(pool)
	supplierRepo := supplier.NewRepo(pool)
	stockRepo := stock.NewRepo(pool)
	revenueRepo := revenue.NewRepo(pool)
	paymentRepo := payment.NewRepo(pool)

	authHandler := auth.NewHandler(authSvc)
	employeeHandler := employee.NewHandler(employeeRepo)
	attendanceHandler := attendance.NewHandler(attendanceRepo)
	payoutHandler := payout.NewHandler(employeeRepo, attendanceRepo)
	itemHandler := item.NewHandler(itemRepo)
	supplierHandler := supplier.NewHandler(supplierRepo)
	stockHandler := stock.NewHandler(stockRepo)
	revenueHandler := revenue.NewHandler(revenueRepo)
	paymentHandler := payment.NewHandler(paymentRepo)
	pnlHandler := pnl.NewHandler(revenueRepo, paymentRepo, stockRepo)

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

		pr.Route("/api/shiftly/employees", func(er chi.Router) {
			er.Get("/", employeeHandler.List)
			er.Post("/", employeeHandler.Create)
			er.Get("/{id}", employeeHandler.Get)
			er.Put("/{id}", employeeHandler.Update)
			er.Delete("/{id}", employeeHandler.Delete)
		})

		pr.Post("/api/shiftly/attendance/log", attendanceHandler.Log)
		pr.Put("/api/shiftly/attendance/override", attendanceHandler.Override)
		pr.Get("/api/shiftly/attendance", attendanceHandler.List)
		pr.Get("/api/shiftly/attendance/activity", attendanceHandler.Activity)

		pr.Get("/api/shiftly/summary/attendance", payoutHandler.AttendanceSummary)
		pr.Get("/api/shiftly/summary/payout", payoutHandler.PayoutSummary)

		pr.Route("/api/pantrly/items", func(ir chi.Router) {
			ir.Get("/", itemHandler.List)
			ir.Post("/", itemHandler.Create)
			ir.Get("/{id}", itemHandler.Get)
			ir.Put("/{id}", itemHandler.Update)
			ir.Delete("/{id}", itemHandler.Delete)
		})

		pr.Route("/api/pantrly/suppliers", func(sr chi.Router) {
			sr.Get("/", supplierHandler.List)
			sr.Post("/", supplierHandler.Create)
			sr.Get("/{id}", supplierHandler.Get)
			sr.Put("/{id}", supplierHandler.Update)
			sr.Delete("/{id}", supplierHandler.Delete)
		})

		pr.Post("/api/pantrly/stock/log", stockHandler.Log)
		pr.Get("/api/pantrly/stock", stockHandler.ListLogs)
		pr.Post("/api/pantrly/purchases", stockHandler.RecordPurchase)
		pr.Get("/api/pantrly/purchases", stockHandler.ListPurchases)
		pr.Get("/api/pantrly/summary/stock", stockHandler.Summary)

		// Ledgerly data entry — same access as every other admin route.
		pr.Route("/api/ledgerly/payments", func(lr chi.Router) {
			lr.Get("/", paymentHandler.List)
			lr.Post("/", paymentHandler.Create)
			lr.Get("/{id}", paymentHandler.Get)
			lr.Put("/{id}", paymentHandler.Update)
			lr.Delete("/{id}", paymentHandler.Delete)
		})
		pr.Post("/api/ledgerly/revenue/log", revenueHandler.LogDaily)
		pr.Get("/api/ledgerly/revenue", revenueHandler.ListDaily)
		pr.Post("/api/ledgerly/revenue/sales", revenueHandler.LogSale)
		pr.Get("/api/ledgerly/revenue/sales", revenueHandler.ListSales)

		// Ledgerly P&L summary — narrower whitelist on top of RequireAuth.
		pr.Group(func(gr chi.Router) {
			gr.Use(access.RequireLedgerlyAdmin(ledgerlyAccessRepo))
			gr.Get("/api/ledgerly/access", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			})
			gr.Get("/api/ledgerly/summary/pnl", pnlHandler.Summary)
		})
	})

	go reconcile.Run(ctx, employeeRepo, attendanceRepo, 5*time.Minute)

	log.Printf("listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
