package pnl

import "testing"

func TestExpenseTotals(t *testing.T) {
	payments := map[string]int64{"rent": 100_000, "salary": 50_000, "utilities": 5_000}
	other, salaryPaid, expenses := expenseTotals(payments, 20_000, 40_000)
	if other != 105_000 {
		t.Errorf("other payments = %d, want 105000", other)
	}
	if salaryPaid != 50_000 {
		t.Errorf("salary payments = %d, want 50000", salaryPaid)
	}
	// rent + utilities + deliveries + salary earned — salary payments are
	// not added on top of the salary they settle.
	if expenses != 165_000 {
		t.Errorf("expenses = %d, want 165000", expenses)
	}
}

func TestExpenseTotalsNoPayments(t *testing.T) {
	other, salaryPaid, expenses := expenseTotals(nil, 0, 7_500)
	if other != 0 || salaryPaid != 0 || expenses != 7_500 {
		t.Errorf("got (%d, %d, %d), want (0, 0, 7500)", other, salaryPaid, expenses)
	}
}
