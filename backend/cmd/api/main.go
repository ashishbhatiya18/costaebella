package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	accessly "attendance-app/costaebella-backend/internal/accessly/access"
	accessuser "attendance-app/costaebella-backend/internal/accessly/user"
	"attendance-app/costaebella-backend/internal/auth"
	"attendance-app/costaebella-backend/internal/config"
	"attendance-app/costaebella-backend/internal/db"
	"attendance-app/costaebella-backend/internal/ledgerly/payment"
	"attendance-app/costaebella-backend/internal/ledgerly/pnl"
	"attendance-app/costaebella-backend/internal/ledgerly/revenue"
	"attendance-app/costaebella-backend/internal/menuly/composition"
	"attendance-app/costaebella-backend/internal/menuly/visibility"
	"attendance-app/costaebella-backend/internal/middleware"
	"attendance-app/costaebella-backend/internal/pantrly/item"
	"attendance-app/costaebella-backend/internal/pantrly/stock"
	"attendance-app/costaebella-backend/internal/pantrly/supplier"
	"attendance-app/costaebella-backend/internal/pantrly/wastage"
	"attendance-app/costaebella-backend/internal/shiftly/advance"
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

	accessUserRepo := accessuser.NewRepo(pool)

	employeeRepo := employee.NewRepo(pool)
	attendanceRepo := attendance.NewRepo(pool)
	advanceRepo := advance.NewRepo(pool)
	itemRepo := item.NewRepo(pool)
	supplierRepo := supplier.NewRepo(pool)
	stockRepo := stock.NewRepo(pool)
	wastageRepo := wastage.NewRepo(pool)
	revenueRepo := revenue.NewRepo(pool)
	paymentRepo := payment.NewRepo(pool)
	visibilityRepo := visibility.NewRepo(pool)
	compositionRepo := composition.NewRepo(pool)

	authHandler := auth.NewHandler(authSvc)
	accessUserHandler := accessuser.NewHandler(accessUserRepo)
	employeeHandler := employee.NewHandler(employeeRepo)
	attendanceHandler := attendance.NewHandler(attendanceRepo)
	advanceHandler := advance.NewHandler(advanceRepo)
	payoutHandler := payout.NewHandler(employeeRepo, attendanceRepo, advanceRepo)
	itemHandler := item.NewHandler(itemRepo)
	supplierHandler := supplier.NewHandler(supplierRepo)
	stockHandler := stock.NewHandler(stockRepo)
	wastageHandler := wastage.NewHandler(wastageRepo)
	revenueHandler := revenue.NewHandler(revenueRepo)
	paymentHandler := payment.NewHandler(paymentRepo)
	pnlHandler := pnl.NewHandler(revenueRepo, paymentRepo, stockRepo, advanceRepo)
	visibilityHandler := visibility.NewHandler(visibilityRepo)
	compositionHandler := composition.NewHandler(compositionRepo)

	r := chi.NewRouter()
	r.Use(middleware.Logging)
	r.Use(middleware.CORS(cfg.AllowedOrigins))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	r.Post("/api/auth/google", authHandler.GoogleLogin)

	// Unauthenticated — the public marketing site (no admin session) polls
	// this to hide 86'd items without a full static-export rebuild.
	r.Get("/api/menuly/visibility/public", visibilityHandler.PublicList)

	r.Group(func(pr chi.Router) {
		pr.Use(middleware.RequireAuth(authSvc))

		// Shiftly employee list/detail — readable by every role that needs
		// to pick an employee elsewhere (operations logging attendance,
		// accounting linking a payment), even though only owners manage
		// employees. Mutations stay owner-only below.
		pr.Group(func(er chi.Router) {
			er.Use(accessly.RequireRole(accessuser.RoleOwner, accessuser.RoleOperations, accessuser.RoleAccounting))
			er.Get("/api/shiftly/employees/", employeeHandler.List)
			er.Get("/api/shiftly/employees/{id}", employeeHandler.Get)
		})

		// Shiftly employee management (create/update/delete) — owner only.
		// Registered as direct routes rather than a Route()/Mount() sub-router:
		// a mount intercepts every method under its prefix, which would shadow
		// the read-only GET routes registered above for the same path.
		pr.Group(func(er chi.Router) {
			er.Use(accessly.RequireOwner())
			er.Post("/api/shiftly/employees/", employeeHandler.Create)
			er.Put("/api/shiftly/employees/{id}", employeeHandler.Update)
			er.Delete("/api/shiftly/employees/{id}", employeeHandler.Delete)
		})

		// Shiftly — staff attendance/payout, restricted to owners and
		// operations (the roles who actually run shifts and pay staff).
		pr.Group(func(sr chi.Router) {
			sr.Use(accessly.RequireRole(accessuser.RoleOwner, accessuser.RoleOperations))

			sr.Post("/api/shiftly/attendance/log", attendanceHandler.Log)
			sr.Put("/api/shiftly/attendance/override", attendanceHandler.Override)
			sr.Get("/api/shiftly/attendance", attendanceHandler.List)
			sr.Get("/api/shiftly/attendance/activity", attendanceHandler.Activity)

			sr.Route("/api/shiftly/advances", func(ar chi.Router) {
				ar.Get("/", advanceHandler.List)
				ar.Post("/", advanceHandler.Create)
				ar.Get("/{id}", advanceHandler.Get)
				ar.Put("/{id}", advanceHandler.Update)
				ar.Delete("/{id}", advanceHandler.Delete)
			})

			sr.Get("/api/shiftly/summary/attendance", payoutHandler.AttendanceSummary)
			sr.Get("/api/shiftly/summary/labor-cost", payoutHandler.LaborCostSummary)
		})

		// Shiftly payout summary — pay figures are accounting's domain, not
		// operations'. Owner + accounting only, unlike the rest of Shiftly
		// above (owner + operations).
		pr.Group(func(pyr chi.Router) {
			pyr.Use(accessly.RequireRole(accessuser.RoleOwner, accessuser.RoleAccounting))
			pyr.Get("/api/shiftly/summary/payout", payoutHandler.PayoutSummary)
		})

		// Pantrly — inventory tracker, same owner+operations roles as Shiftly.
		pr.Group(func(ir chi.Router) {
			ir.Use(accessly.RequireRole(accessuser.RoleOwner, accessuser.RoleOperations))

			ir.Route("/api/pantrly/items", func(r chi.Router) {
				r.Get("/", itemHandler.List)
				r.Post("/", itemHandler.Create)
				r.Get("/{id}", itemHandler.Get)
				r.Put("/{id}", itemHandler.Update)
				r.Delete("/{id}", itemHandler.Delete)
				r.Post("/{id}/suppliers", itemHandler.AddSupplier)
				r.Get("/{id}/suppliers", itemHandler.ListItemSuppliers)
				r.Delete("/{id}/suppliers/{supplier_id}", itemHandler.RemoveSupplier)
			})

			ir.Route("/api/pantrly/suppliers", func(r chi.Router) {
				r.Get("/", supplierHandler.List)
				r.Post("/", supplierHandler.Create)
				r.Get("/{id}", supplierHandler.Get)
				r.Put("/{id}", supplierHandler.Update)
				r.Delete("/{id}", supplierHandler.Delete)
				r.Get("/{id}/items", supplierHandler.ListItems)
			})

			ir.Post("/api/pantrly/stock/log", stockHandler.Log)
			ir.Get("/api/pantrly/stock", stockHandler.ListLogs)
			ir.Delete("/api/pantrly/stock/{id}", stockHandler.DeleteLog)
			ir.Post("/api/pantrly/purchases", stockHandler.RecordPurchase)
			ir.Get("/api/pantrly/purchases", stockHandler.ListPurchases)
			ir.Delete("/api/pantrly/purchases/{id}", stockHandler.DeletePurchase)
			ir.Get("/api/pantrly/summary/stock", stockHandler.Summary)

			ir.Post("/api/pantrly/wastage", wastageHandler.Log)
			ir.Get("/api/pantrly/wastage", wastageHandler.List)
			ir.Delete("/api/pantrly/wastage/{id}", wastageHandler.Delete)
		})

		// Ledgerly data entry — restricted to owners and accounting.
		pr.Group(func(lr chi.Router) {
			lr.Use(accessly.RequireRole(accessuser.RoleOwner, accessuser.RoleAccounting))

			lr.Route("/api/ledgerly/payments", func(r chi.Router) {
				r.Get("/", paymentHandler.List)
				r.Post("/", paymentHandler.Create)
				r.Get("/{id}", paymentHandler.Get)
				r.Put("/{id}", paymentHandler.Update)
				r.Delete("/{id}", paymentHandler.Delete)
			})
			lr.Post("/api/ledgerly/revenue/sales", revenueHandler.LogSale)
			lr.Get("/api/ledgerly/revenue/sales", revenueHandler.ListSales)
			lr.Delete("/api/ledgerly/revenue/sales/{id}", revenueHandler.DeleteSale)

			// Ledgerly P&L summary, and the whole of Menuly/Intel-ly —
			// owner-only, narrower than the owner/accounting role check
			// above that gates the rest of Ledgerly. Intel-ly has no routes
			// of its own (it only composes other apps' endpoints
			// client-side), so gating Menuly here plus the frontend
			// app-level gate is what actually restricts it.
			lr.Group(func(gr chi.Router) {
				gr.Use(accessly.RequireOwner())
				gr.Get("/api/ledgerly/access", func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusNoContent)
				})
				gr.Get("/api/ledgerly/summary/pnl", pnlHandler.Summary)

				gr.Get("/api/menuly/visibility", visibilityHandler.List)
				gr.Put("/api/menuly/visibility", visibilityHandler.Set)

				gr.Get("/api/menuly/composition", compositionHandler.List)
				gr.Put("/api/menuly/composition", compositionHandler.Set)
				gr.Delete("/api/menuly/composition/{id}", compositionHandler.Delete)
			})
		})

		// Accessly — user account management, owner-only.
		pr.Group(func(ar chi.Router) {
			ar.Use(accessly.RequireOwner())
			ar.Get("/api/accessly/access", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			})
			ar.Route("/api/accessly/users", func(ur chi.Router) {
				ur.Get("/", accessUserHandler.List)
				ur.Post("/", accessUserHandler.Create)
				ur.Put("/{id}/role", accessUserHandler.UpdateRole)
				ur.Delete("/{id}", accessUserHandler.Delete)
			})
		})
	})

	go reconcile.Run(ctx, employeeRepo, attendanceRepo, 5*time.Minute)

	log.Printf("listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
