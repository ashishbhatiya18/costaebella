package payout

import (
	"context"
	"math"
	"time"

	"attendance-app/costaebella-backend/internal/shiftly/attendance"
	"attendance-app/costaebella-backend/internal/shiftly/employee"
)

// Day categories, used both for the attendance-summary UI and to flag
// "irregular" employee-days in LaborCostSummary.
const (
	CategoryBeforeStart = "before_start"
	CategoryPresent     = "present"
	CategoryLeave       = "leave"
	CategoryAbsent      = "absent"
	CategoryWeeklyOff   = "weekly_off"
)

// EmployeeAvailability summarizes one employee's attendance over a date range.
type EmployeeAvailability struct {
	EmployeeID    string            `json:"employee_id"`
	EmployeeName  string            `json:"employee_name"`
	ExpectedDays  int               `json:"expected_days"`
	ActualDays    int               `json:"actual_days"`
	ExpectedHours float64           `json:"expected_hours"`
	ActualHours   float64           `json:"actual_hours"`
	AttendancePct float64           `json:"attendance_pct"`
	Days          []DayAvailability `json:"days"`
}

// DayAvailability describes a single day's classification, under the
// simplified hourly model: a day is either before the employee's start date,
// on leave (admin/self marked), present (at least one closed session), or
// absent (no session, not marked leave).
type DayAvailability struct {
	Date          string  `json:"date"`
	BeforeStart   bool    `json:"before_start"`
	IsWeeklyOff   bool    `json:"is_weekly_off"`
	Present       bool    `json:"present"`
	Leave         bool    `json:"leave"`
	AutoLogout    bool    `json:"auto_logout"`
	HoursWorked   float64 `json:"hours_worked"`   // raw sum of closed sessions that day
	RoundedHours  float64 `json:"rounded_hours"`  // hours_worked rounded to the nearest hour
	ExpectedHours float64 `json:"expected_hours"` // employee's configured eligible_hours_per_day
	Category      string  `json:"category"`
}

// SessionTimes is one login/logout pair on a given day, as RFC3339
// timestamps — callers format these for display (e.g. in the payout PDF
// report), consistent with how the rest of the app renders attendance
// times client-side.
type SessionTimes struct {
	Login  string  `json:"login"`
	Logout *string `json:"logout"` // nil if the session is still open
}

// DailyPayoutLine is one employee's computed pay for a single day within a
// ComputeHourlyPayout run.
type DailyPayoutLine struct {
	Date         string         `json:"date"`
	Category     string         `json:"category"`
	Sessions     []SessionTimes `json:"sessions"`
	RawHours     float64        `json:"raw_hours"`
	RoundedHours float64        `json:"rounded_hours"`
	DayPayCents  int64          `json:"day_pay_cents"`
}

// sessionTimesFor lists a day's sessions as login/logout RFC3339 pairs.
func sessionTimesFor(dayLogs []attendance.Log) []SessionTimes {
	out := make([]SessionTimes, 0, len(dayLogs))
	for _, l := range dayLogs {
		if l.LoginTime == nil {
			continue
		}
		st := SessionTimes{Login: l.LoginTime.Format(time.RFC3339)}
		if l.LogoutTime != nil {
			logout := l.LogoutTime.Format(time.RFC3339)
			st.Logout = &logout
		}
		out = append(out, st)
	}
	return out
}

// EmployeePayout summarizes one employee's computed monthly payout under the
// flat-hourly-rate model:
//
//	weekly_off_count      = number of days in the period whose weekday is one
//	                        of the employee's weekly_off_days (an exact count
//	                        of actual occurrences that month, not an average)
//	working_days_in_month = total_days_in_month - weekly_off_count
//	hourly_rate           = monthly_pay / (working_days_in_month * eligible_hours_per_day)
//	day_pay               = round_to_nearest_hour(hours_worked_that_day) * hourly_rate
//
// When the employee joined partway through the month, the day range (and so
// TotalDays/WorkingDaysInMonth) is already restricted to start from their
// start date — MonthlyPayCents itself is never scaled down, since paying by
// the hour over fewer working days already accounts for the shorter month.
type EmployeePayout struct {
	EmployeeID          string            `json:"employee_id"`
	EmployeeName        string            `json:"employee_name"`
	MonthlyPayCents     int64             `json:"monthly_pay_cents"`
	TotalDays           int               `json:"total_days"` // countable calendar days in the period
	WeeklyOffDays       []int             `json:"weekly_off_days"`
	WeeklyOffCount      int               `json:"weekly_off_count"` // actual occurrences of those weekdays in the period
	EligibleHoursPerDay float64           `json:"eligible_hours_per_day"`
	WorkingDaysInMonth  int               `json:"working_days_in_month"`
	HourlyRateCents     float64           `json:"hourly_rate_cents"`
	TotalHoursWorked    float64           `json:"total_hours_worked"`
	GrossPayCents       int64             `json:"gross_pay_cents"`
	AdvanceCents        int64             `json:"advance_cents"`
	NetPayoutCents      int64             `json:"net_payout_cents"`
	DailyBreakdown      []DailyPayoutLine `json:"daily_breakdown"`
}

// countWeeklyOffDays counts how many days in [from, to] (inclusive) fall on
// one of offDays (0=Sun..6=Sat) — an exact count of real occurrences for
// that specific period, not an average/approximation.
func countWeeklyOffDays(offDays []int, from, to time.Time) int {
	if len(offDays) == 0 {
		return 0
	}
	set := make(map[int]bool, len(offDays))
	for _, d := range offDays {
		set[d] = true
	}
	count := 0
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		if set[int(d.Weekday())] {
			count++
		}
	}
	return count
}

// DailyLaborCost is one employee's computed gross labor cost for a single
// day — used by LaborCostSummary to aggregate across employees.
type DailyLaborCost struct {
	Date      string `json:"date"`
	Category  string `json:"category"`
	CostCents int64  `json:"cost_cents"`
}

// parseDate parses a YYYY-MM-DD date, returning ok=false if empty/invalid.
func parseDate(s string) (t time.Time, ok bool) {
	if s == "" {
		return time.Time{}, false
	}
	parsed, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}, false
	}
	return parsed, true
}

// groupByDate buckets one employee's log rows (sessions and/or a leave
// marker) by log_date.
func groupByDate(logs []attendance.Log, employeeID string) map[string][]attendance.Log {
	out := map[string][]attendance.Log{}
	for _, l := range logs {
		if l.EmployeeID != employeeID {
			continue
		}
		out[l.LogDate] = append(out[l.LogDate], l)
	}
	return out
}

// sessionHours sums the duration of a day's closed sessions (open sessions
// with no logout yet don't count).
func sessionHours(dayLogs []attendance.Log) float64 {
	var total float64
	for _, l := range dayLogs {
		if l.LoginTime != nil && l.LogoutTime != nil {
			hrs := l.LogoutTime.Sub(*l.LoginTime).Hours()
			if hrs > 0 {
				total += hrs
			}
		}
	}
	return total
}

// roundHoursToNearestHour rounds a day's worked hours to the nearest whole
// hour, rounding .5 and above up (e.g. 9h31m -> 10h, 9h29m -> 9h).
func roundHoursToNearestHour(hours float64) float64 {
	if hours <= 0 {
		return 0
	}
	return math.Floor(hours + 0.5)
}

// dayFlags is a small helper shared by ComputeAvailability and
// ComputeHourlyPayout. isWeeklyOffOverride reflects an admin's one-off
// "mark this day as weekly off" override (attendance_logs.is_weekly_off),
// distinct from the employee's recurring weekly_off_days schedule — it only
// changes the day's displayed category, never the payout computation.
func dayFlags(dayLogs []attendance.Log) (isLeave, autoLogout, isWeeklyOffOverride bool) {
	for _, l := range dayLogs {
		if l.IsLeave {
			isLeave = true
		}
		if l.AutoLogout {
			autoLogout = true
		}
		if l.IsWeeklyOff {
			isWeeklyOffOverride = true
		}
	}
	return
}

// ComputeAvailability builds a day-by-day and aggregate availability summary
// for one employee across [from, to] (inclusive). Days before the employee's
// start_date are excluded from expected/actual calculations entirely.
func ComputeAvailability(e employee.Employee, logs []attendance.Log, from, to time.Time) EmployeeAvailability {
	byDate := groupByDate(logs, e.ID)
	startDate, hasStartDate := parseDate(e.StartDate)

	offDays := make(map[int]bool, len(e.WeeklyOffDays))
	for _, d := range e.WeeklyOffDays {
		offDays[d] = true
	}

	result := EmployeeAvailability{EmployeeID: e.ID, EmployeeName: e.Name}

	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		beforeStart := hasStartDate && d.Before(startDate)
		isWeeklyOff := offDays[int(d.Weekday())]
		dateStr := d.Format("2006-01-02")
		dayLogs := byDate[dateStr]

		isLeaveMarked, autoLogout, isWeeklyOffOverride := dayFlags(dayLogs)
		hoursWorked := sessionHours(dayLogs)
		rounded := roundHoursToNearestHour(hoursWorked)
		present := !isLeaveMarked && rounded > 0

		day := DayAvailability{
			Date:          dateStr,
			BeforeStart:   beforeStart,
			IsWeeklyOff:   isWeeklyOff || isWeeklyOffOverride,
			Present:       present,
			Leave:         isLeaveMarked,
			AutoLogout:    autoLogout,
			HoursWorked:   hoursWorked,
			RoundedHours:  rounded,
			ExpectedHours: e.EligibleHoursPerDay,
		}

		switch {
		case beforeStart:
			day.Category = CategoryBeforeStart
		case isLeaveMarked:
			day.Category = CategoryLeave
		case isWeeklyOffOverride:
			day.Category = CategoryWeeklyOff
		case present:
			day.Category = CategoryPresent
		case isWeeklyOff:
			day.Category = CategoryWeeklyOff
		default:
			day.Category = CategoryAbsent
		}

		if !beforeStart {
			result.ExpectedDays++
			result.ExpectedHours += e.EligibleHoursPerDay
		}
		if present {
			result.ActualDays++
			result.ActualHours += hoursWorked
		}
		result.Days = append(result.Days, day)
	}

	if result.ExpectedDays > 0 {
		result.AttendancePct = (float64(result.ActualDays) / float64(result.ExpectedDays)) * 100
	}
	return result
}

// ComputeHourlyPayout computes a single employee's payout for a calendar
// month under the flat-hourly-rate policy described on EmployeePayout.
func ComputeHourlyPayout(e employee.Employee, logs []attendance.Log, monthStart, monthEnd time.Time, advanceCents int64) EmployeePayout {
	monthlyPay := e.MonthlyPayCents

	base := EmployeePayout{
		EmployeeID:          e.ID,
		EmployeeName:        e.Name,
		WeeklyOffDays:       e.WeeklyOffDays,
		EligibleHoursPerDay: e.EligibleHoursPerDay,
	}

	startDate, hasStartDate := parseDate(e.StartDate)
	windowStart := monthStart
	if hasStartDate && startDate.After(windowStart) {
		windowStart = startDate
	}
	if windowStart.After(monthEnd) {
		// Employee hasn't started yet this month.
		return base
	}

	byDate := groupByDate(logs, e.ID)

	totalDays := int(monthEnd.Sub(windowStart).Hours()/24) + 1
	weeklyOffCount := countWeeklyOffDays(e.WeeklyOffDays, windowStart, monthEnd)
	workingDays := totalDays - weeklyOffCount
	if workingDays < 0 {
		workingDays = 0
	}

	var hourlyRateCents float64
	if workingDays > 0 && e.EligibleHoursPerDay > 0 {
		hourlyRateCents = float64(monthlyPay) / (float64(workingDays) * e.EligibleHoursPerDay)
	}

	offDays := make(map[int]bool, len(e.WeeklyOffDays))
	for _, d := range e.WeeklyOffDays {
		offDays[d] = true
	}

	var totalHours, grossPay float64
	breakdown := make([]DailyPayoutLine, 0, totalDays)
	for d := windowStart; !d.After(monthEnd); d = d.AddDate(0, 0, 1) {
		dateStr := d.Format("2006-01-02")
		dayLogs := byDate[dateStr]
		isLeaveMarked, _, isWeeklyOffOverride := dayFlags(dayLogs)
		raw := sessionHours(dayLogs)
		rounded := roundHoursToNearestHour(raw)
		dayPay := rounded * hourlyRateCents

		category := CategoryAbsent
		switch {
		case isLeaveMarked:
			category = CategoryLeave
		case isWeeklyOffOverride:
			category = CategoryWeeklyOff
		case rounded > 0:
			category = CategoryPresent
		case offDays[int(d.Weekday())]:
			category = CategoryWeeklyOff
		}

		totalHours += rounded
		grossPay += dayPay
		breakdown = append(breakdown, DailyPayoutLine{
			Date:         dateStr,
			Category:     category,
			Sessions:     sessionTimesFor(dayLogs),
			RawHours:     raw,
			RoundedHours: rounded,
			DayPayCents:  int64(math.Round(dayPay)),
		})
	}

	gross := int64(math.Round(grossPay))
	if gross < 0 {
		gross = 0
	}
	net := gross - advanceCents
	if net < 0 {
		net = 0
	}

	base.MonthlyPayCents = monthlyPay
	base.TotalDays = totalDays
	base.WeeklyOffCount = weeklyOffCount
	base.WorkingDaysInMonth = workingDays
	base.HourlyRateCents = hourlyRateCents
	base.TotalHoursWorked = totalHours
	base.GrossPayCents = gross
	base.AdvanceCents = advanceCents
	base.NetPayoutCents = net
	base.DailyBreakdown = breakdown
	return base
}

// RangeLaborCostTotal sums gross labor cost (the same day-level figures
// LaborCostSummary reports) across all employees for [from, to] — used by
// Ledgerly's P&L to fold accrued-but-maybe-unpaid salary into expenses.
// Internally runs ComputeHourlyPayout once per month the range touches (so
// each day's cost stays consistent with the real payout run), then clips
// each employee's daily breakdown to the requested window before summing.
func RangeLaborCostTotal(ctx context.Context, employees *employee.Repo, attendances *attendance.Repo, from, to time.Time) (int64, error) {
	if to.Before(from) {
		return 0, nil
	}

	allEmployees, err := employees.List(ctx)
	if err != nil {
		return 0, err
	}

	var total int64
	for monthStart := time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, time.UTC); !monthStart.After(to); monthStart = monthStart.AddDate(0, 1, 0) {
		monthEnd := monthStart.AddDate(0, 1, -1)

		logs, err := attendances.ListRange(ctx, "", monthStart.Format("2006-01-02"), monthEnd.Format("2006-01-02"))
		if err != nil {
			return 0, err
		}

		for _, e := range allEmployees {
			payout := ComputeHourlyPayout(e, logs, monthStart, monthEnd, 0)
			for _, dc := range payout.DailyBreakdown {
				d, err := time.Parse("2006-01-02", dc.Date)
				if err != nil || d.Before(from) || d.After(to) {
					continue
				}
				total += dc.DayPayCents
			}
		}
	}
	return total, nil
}
