package payout

import (
	"math"
	"time"

	"attendance-app/costaebella-backend/internal/attendance"
	"attendance-app/costaebella-backend/internal/employee"
)

// Day categories. "leave" may be downgraded to "unpaid_leave" by
// ComputePayout once the monthly permitted-leave allowance is exhausted.
const (
	CategoryBeforeStart     = "before_start"
	CategoryWeeklyOff       = "weekly_off"
	CategoryWeeklyOffWorked = "weekly_off_worked"
	CategoryLeave           = "leave"
	CategoryUnpaidLeave     = "unpaid_leave"
	CategoryAbsent          = "absent"
	CategoryHalfDay         = "half_day"
	CategoryFullDay         = "full_day"
	CategoryFullDayOT       = "full_day_ot"
)

// Absolute-hour classification bands for a committed working day:
//
//	0h            -> absent (no leave allowance consumed)
//	(0h, 5h)      -> leave (auto; consumes the monthly leave allowance)
//	[5h, 7h)      -> half day
//	[7h, 10h]     -> full day
//	>10h          -> full day + overtime bonus for hours beyond 10h
const (
	leaveHoursThreshold = 5.0  // <5h worked (but >0) -> auto leave
	halfDayHoursCeiling = 7.0  // [5,7) -> half day
	otHoursThreshold    = 10.0 // >10h -> overtime; [.., 10] -> full day
	fallbackStdHours    = 8.0  // used only if an employee has no committed days configured
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

// DayAvailability describes a single day's classification. Category is the
// primary signal for display; the booleans/numbers below give supporting
// detail (e.g. for tooltips).
type DayAvailability struct {
	Date               string  `json:"date"`
	BeforeStart        bool    `json:"before_start"`
	IsWeeklyOff        bool    `json:"is_weekly_off"`
	WithinAvailability bool    `json:"within_availability"` // true = committed working day
	Present            bool    `json:"present"`             // at least one session logged (not leave)
	Leave              bool    `json:"leave"`
	AutoLogout         bool    `json:"auto_logout"`
	HoursWorked        float64 `json:"hours_worked"`   // sum of closed sessions that day
	ExpectedHours      float64 `json:"expected_hours"` // this day's configured shift hours (0 for weekly-off/before-start); always <=9, enforced at employee setup
	HoursPct           float64 `json:"hours_pct"`      // informational only; classification uses absolute hour bands, not this pct
	Category           string  `json:"category"`
	DayCredit          float64 `json:"day_credit"`  // 0 / 0.5 / 1.0
	BonusHours         float64 `json:"bonus_hours"` // hours eligible for the hourly bonus (OT or weekly-off-worked)
}

// EmployeePayout summarizes one employee's computed monthly payout. When the
// employee joined partway through the month, MonthlyPayCents/PermittedLeaves
// are already prorated to the fraction of the month from their start date.
type EmployeePayout struct {
	EmployeeID          string  `json:"employee_id"`
	EmployeeName        string  `json:"employee_name"`
	MonthlyPayCents     int64   `json:"monthly_pay_cents"`
	FullMonthlyPayCents int64   `json:"full_monthly_pay_cents"`
	TotalDays           int     `json:"total_days"` // countable calendar days in the (prorated) period
	FullDayCount        int     `json:"full_day_count"`
	HalfDayCount        int     `json:"half_day_count"`
	AbsentCount         int     `json:"absent_count"`
	WeeklyOffCount      int     `json:"weekly_off_count"`
	LeavesTaken         int     `json:"leaves_taken"`
	PermittedLeaves     int     `json:"permitted_leaves"`
	UnpaidLeaveDays     int     `json:"unpaid_leave_days"`
	BonusHours          float64 `json:"bonus_hours"`
	BasePayCents        int64   `json:"base_pay_cents"`
	BonusPayCents       int64   `json:"bonus_pay_cents"`
	PayoutCents         int64   `json:"payout_cents"`
	ProratedFraction    float64 `json:"prorated_fraction"`
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

// isCommittedDay reports whether weekday (0=Sun..6=Sat) is one of the
// employee's committed working days.
func isCommittedDay(committed []int, weekday int) bool {
	for _, d := range committed {
		if d == weekday {
			return true
		}
	}
	return false
}

// expectedHoursForDay sums the duration of all shift intervals applicable to
// the given weekday (day-specific intervals plus "every day" ones).
func expectedHoursForDay(e employee.Employee, weekday int) float64 {
	var total float64
	for _, si := range e.ShiftIntervals {
		if si.DayOfWeek == nil || *si.DayOfWeek == weekday {
			total += parseHours(si.StartTime, si.EndTime)
		}
	}
	return total
}

// standardDailyHours is the employee's average expected hours across their
// committed weekdays — used as the base for their single "hourly rate"
// (overtime and weekly-off-worked bonuses).
func standardDailyHours(e employee.Employee) float64 {
	if len(e.CommittedWorkingDays) == 0 {
		return fallbackStdHours
	}
	var total float64
	for _, wd := range e.CommittedWorkingDays {
		total += expectedHoursForDay(e, wd)
	}
	avg := total / float64(len(e.CommittedWorkingDays))
	if avg <= 0 {
		return fallbackStdHours
	}
	return avg
}

// parseHours returns the duration of a shift interval. If end is at or
// before start (e.g. 16:00-00:00 or 23:00-05:00), the shift is treated as
// running past midnight into the next day.
func parseHours(start, end string) float64 {
	st, err1 := time.Parse("15:04", start)
	et, err2 := time.Parse("15:04", end)
	if err1 != nil || err2 != nil {
		return 0
	}
	if !et.After(st) {
		et = et.Add(24 * time.Hour)
	}
	return et.Sub(st).Hours()
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

// ComputeAvailability builds a day-by-day and aggregate availability summary
// for one employee across [from, to] (inclusive). Days before the employee's
// start_date are excluded from expected/committed calculations entirely.
// Leave days are tentatively credited in full here; ComputePayout applies
// the monthly permitted-leave cap on top of this.
func ComputeAvailability(e employee.Employee, logs []attendance.Log, from, to time.Time) EmployeeAvailability {
	byDate := groupByDate(logs, e.ID)
	startDate, hasStartDate := parseDate(e.StartDate)

	result := EmployeeAvailability{EmployeeID: e.ID, EmployeeName: e.Name}

	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		beforeStart := hasStartDate && d.Before(startDate)
		weekday := int(d.Weekday())
		committed := !beforeStart && isCommittedDay(e.CommittedWorkingDays, weekday)
		dateStr := d.Format("2006-01-02")
		dayLogs := byDate[dateStr]

		isLeaveMarked := false
		for _, l := range dayLogs {
			if l.IsLeave {
				isLeaveMarked = true
			}
		}
		present := !isLeaveMarked && len(dayLogs) > 0
		autoLogout := false
		for _, l := range dayLogs {
			if l.AutoLogout {
				autoLogout = true
			}
		}
		hoursWorked := sessionHours(dayLogs)

		day := DayAvailability{
			Date:               dateStr,
			BeforeStart:        beforeStart,
			IsWeeklyOff:        !beforeStart && !committed,
			WithinAvailability: committed,
			Present:            present,
			Leave:              isLeaveMarked,
			AutoLogout:         autoLogout,
			HoursWorked:        hoursWorked,
		}

		switch {
		case beforeStart:
			day.Category = CategoryBeforeStart

		case !committed: // weekly off
			day.DayCredit = 1.0
			if present && hoursWorked > 0 {
				day.Category = CategoryWeeklyOffWorked
				day.BonusHours = hoursWorked
			} else {
				day.Category = CategoryWeeklyOff
			}

		case isLeaveMarked:
			day.Category = CategoryLeave
			day.DayCredit = 1.0

		default:
			day.ExpectedHours = expectedHoursForDay(e, weekday)
			if day.ExpectedHours > 0 {
				day.HoursPct = (hoursWorked / day.ExpectedHours) * 100
			}
			switch {
			case hoursWorked == 0:
				// No completed hours at all (never showed up, or clocked in
				// but the session is still open) — plain absence, doesn't
				// touch the leave allowance.
				day.Category = CategoryAbsent
			case hoursWorked < leaveHoursThreshold:
				// Showed up but left early enough that it's treated as a
				// leave day (auto), subject to the monthly allowance cap
				// applied in ComputePayout — same as an admin-marked leave.
				day.Category = CategoryLeave
				day.DayCredit = 1.0
			case hoursWorked < halfDayHoursCeiling:
				day.Category = CategoryHalfDay
				day.DayCredit = 0.5
			case hoursWorked <= otHoursThreshold:
				day.Category = CategoryFullDay
				day.DayCredit = 1.0
			default:
				day.Category = CategoryFullDayOT
				day.DayCredit = 1.0
				day.BonusHours = hoursWorked - otHoursThreshold
			}
		}

		if committed {
			result.ExpectedDays++
			result.ExpectedHours += day.ExpectedHours
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

// ComputePayout computes a single employee's payout for a calendar month
// under the hours-based policy:
//   - Weekly-off days are always paid in full; working them adds an hourly
//     bonus for every hour worked.
//   - Committed working days pay absent/leave/half/full/OT based on
//     absolute hours worked that day (0h absent, <5h auto-leave, 5-7h half,
//     7-10h full, >10h full + hourly bonus for the hours beyond 10).
//   - Approved leave pays in full up to the (prorated) monthly allowance;
//     beyond that it's unpaid.
//   - The daily rate is the prorated monthly pay divided by the number of
//     countable calendar days in the period (not just committed days),
//     since weekly offs are now part of the paid base.
func ComputePayout(e employee.Employee, logs []attendance.Log, monthStart, monthEnd time.Time) EmployeePayout {
	avail := ComputeAvailability(e, logs, monthStart, monthEnd)

	fraction := prorationFraction(e.StartDate, monthStart, monthEnd)
	fullMonthlyPay := e.MonthlyPayCents
	proratedMonthlyPay := int64(math.Round(float64(fullMonthlyPay) * fraction))
	proratedPermittedLeaves := int(math.Round(float64(e.PermittedLeavesPerMonth) * fraction))

	totalDays := 0
	for _, d := range avail.Days {
		if !d.BeforeStart {
			totalDays++
		}
	}

	var dailyRateCents float64
	if totalDays > 0 {
		dailyRateCents = float64(proratedMonthlyPay) / float64(totalDays)
	}
	hourlyRateCents := dailyRateCents / standardDailyHours(e)

	var (
		basePay, bonusPay                                       float64
		bonusHours                                              float64
		fullDayCount, halfDayCount, absentCount, weeklyOffCount int
		leaveUsed, leavesTaken, unpaidLeaveDays                 int
	)

	for _, d := range avail.Days {
		category := d.Category
		dayCredit := d.DayCredit

		if category == CategoryLeave {
			leaveUsed++
			if leaveUsed > proratedPermittedLeaves {
				category = CategoryUnpaidLeave
				dayCredit = 0
				unpaidLeaveDays++
			} else {
				leavesTaken++
			}
		}

		switch category {
		case CategoryFullDay, CategoryFullDayOT:
			fullDayCount++
		case CategoryHalfDay:
			halfDayCount++
		case CategoryAbsent:
			absentCount++
		case CategoryWeeklyOff, CategoryWeeklyOffWorked:
			weeklyOffCount++
		}

		basePay += dayCredit * dailyRateCents
		bonusHours += d.BonusHours
	}
	bonusPay = bonusHours * hourlyRateCents

	payout := int64(math.Round(basePay + bonusPay))
	if payout < 0 {
		payout = 0
	}

	return EmployeePayout{
		EmployeeID:          e.ID,
		EmployeeName:        e.Name,
		MonthlyPayCents:     proratedMonthlyPay,
		FullMonthlyPayCents: fullMonthlyPay,
		TotalDays:           totalDays,
		FullDayCount:        fullDayCount,
		HalfDayCount:        halfDayCount,
		AbsentCount:         absentCount,
		WeeklyOffCount:      weeklyOffCount,
		LeavesTaken:         leavesTaken,
		PermittedLeaves:     proratedPermittedLeaves,
		UnpaidLeaveDays:     unpaidLeaveDays,
		BonusHours:          bonusHours,
		BasePayCents:        int64(math.Round(basePay)),
		BonusPayCents:       int64(math.Round(bonusPay)),
		PayoutCents:         payout,
		ProratedFraction:    fraction,
	}
}

// prorationFraction returns what fraction of [monthStart, monthEnd] (both
// inclusive calendar days) falls on or after startDateStr. Returns 1 if
// startDateStr is empty/invalid or falls on/before monthStart, and 0 if it
// falls after monthEnd.
func prorationFraction(startDateStr string, monthStart, monthEnd time.Time) float64 {
	startDate, ok := parseDate(startDateStr)
	if !ok || !startDate.After(monthStart) {
		return 1
	}
	if startDate.After(monthEnd) {
		return 0
	}

	daysInMonth := int(monthEnd.Sub(monthStart).Hours()/24) + 1
	effectiveDays := int(monthEnd.Sub(startDate).Hours()/24) + 1
	return float64(effectiveDays) / float64(daysInMonth)
}
