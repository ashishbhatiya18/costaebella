package employee

import "time"

type Employee struct {
	ID                  string    `json:"id,omitempty"`
	Name                string    `json:"name"`
	ShiftName           string    `json:"shift_name"`
	MonthlyPayCents     int64     `json:"monthly_pay_cents"`
	WeeklyOffDays       []int     `json:"weekly_off_days"` // 0=Sun..6=Sat; days the employee is not expected to work
	EligibleHoursPerDay float64   `json:"eligible_hours_per_day"`
	StartDate           string    `json:"start_date"` // YYYY-MM-DD; attendance/payout only considered from this date on
	Active              bool      `json:"active"`
	CreatedAt           time.Time `json:"created_at,omitempty"`
	UpdatedAt           time.Time `json:"updated_at,omitempty"`
}
