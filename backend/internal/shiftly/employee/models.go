package employee

import "time"

type ShiftInterval struct {
	ID        string `json:"id,omitempty"`
	DayOfWeek *int   `json:"day_of_week"` // nil = every committed day
	StartTime string `json:"start_time"`  // "HH:MM"
	EndTime   string `json:"end_time"`    // "HH:MM"
}

type Employee struct {
	ID                      string          `json:"id,omitempty"`
	Name                    string          `json:"name"`
	ShiftName               string          `json:"shift_name"`
	MonthlyPayCents         int64           `json:"monthly_pay_cents"`
	CommittedWorkingDays    []int           `json:"committed_working_days"` // 0=Sun .. 6=Sat
	PermittedLeavesPerMonth int             `json:"permitted_leaves_per_month"`
	StartDate               string          `json:"start_date"` // YYYY-MM-DD; attendance/payout only considered from this date on
	Active                  bool            `json:"active"`
	ShiftIntervals          []ShiftInterval `json:"shift_intervals"`
	CreatedAt               time.Time       `json:"created_at,omitempty"`
	UpdatedAt               time.Time       `json:"updated_at,omitempty"`
}
