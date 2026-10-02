package stock

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// A future or pre-opening purchase_date is rejected before anything touches
// the repo (the handler's repo is nil here, so reaching it would panic).
func TestRecordPurchaseRejectsOutOfRangeDates(t *testing.T) {
	h := NewHandler(nil)
	tomorrow := time.Now().In(ist).AddDate(0, 0, 1).Format("2006-01-02")

	cases := map[string]string{
		"future":         tomorrow,
		"before opening": "2026-07-31",
		"malformed":      "29-10-2026",
	}
	for name, date := range cases {
		t.Run(name, func(t *testing.T) {
			body := `{"item_id":"x","quantity":1,"cost_cents":100,"purchase_date":"` + date + `"}`
			rec := httptest.NewRecorder()
			h.RecordPurchase(rec, httptest.NewRequest(http.MethodPost, "/api/pantrly/purchases", strings.NewReader(body)))
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("date %s: got status %d, want 400 (%s)", date, rec.Code, rec.Body.String())
			}
		})
	}
}
