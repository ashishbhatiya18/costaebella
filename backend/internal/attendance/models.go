package attendance

import "time"

type Log struct {
	ID         string     `json:"id"`
	EmployeeID string     `json:"employee_id"`
	LogDate    string     `json:"log_date"` // YYYY-MM-DD
	LoginTime  *time.Time `json:"login_time"`
	LogoutTime *time.Time `json:"logout_time"`
	AutoLogout bool       `json:"auto_logout"`
	IsLeave    bool       `json:"is_leave"`
}

type LogRequest struct {
	EmployeeID string  `json:"employee_id"`
	Date       string  `json:"date"`  // YYYY-MM-DD, defaults to today if empty
	Field      string  `json:"field"` // "login" or "logout"
	Time       *string `json:"time"`  // RFC3339, optional override; defaults to now
}

// SessionInput is one login/logout pair supplied by an admin override.
type SessionInput struct {
	LoginTime  string  `json:"login_time"`  // RFC3339, required
	LogoutTime *string `json:"logout_time"` // RFC3339, or null if still open
}

// OverrideRequest lets an admin directly replace all attendance for an
// employee+date in one shot, e.g. to correct an auto-closed shift, log a
// forgotten split-shift session, or mark the day as an approved leave (which
// discards any sessions supplied).
type OverrideRequest struct {
	EmployeeID string         `json:"employee_id"`
	Date       string         `json:"date"` // YYYY-MM-DD
	IsLeave    bool           `json:"is_leave"`
	Sessions   []SessionInput `json:"sessions"`
}

// ActivityItem is a single login or logout event in the recent activity feed.
type ActivityItem struct {
	EmployeeID   string    `json:"employee_id"`
	EmployeeName string    `json:"employee_name"`
	Field        string    `json:"field"` // "login" or "logout"
	At           time.Time `json:"at"`
}
