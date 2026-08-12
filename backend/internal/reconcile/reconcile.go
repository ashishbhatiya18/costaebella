// Package reconcile periodically closes out attendance logs that were never
// manually logged out, so a forgotten logout doesn't leave an employee stuck
// "logged in" indefinitely and skewing hours-worked/payout calculations.
package reconcile

import (
	"context"
	"log"
	"time"

	"attendance-app/costaebella-backend/internal/attendance"
	"attendance-app/costaebella-backend/internal/employee"
)

// fallbackOpenShiftHours is used when an open log's employee has no shift
// interval covering that day (e.g. schedule changed after the fact) — we
// still need to close it eventually rather than leave it open forever.
const fallbackOpenShiftHours = 16

// Run starts a background loop that closes expired open shifts every
// interval, until ctx is cancelled.
func Run(ctx context.Context, employees *employee.Repo, attendances *attendance.Repo, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		if err := CloseExpiredShifts(ctx, employees, attendances); err != nil {
			log.Printf("auto-logout reconcile failed: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// CloseExpiredShifts finds attendance logs with a login but no logout, and
// auto-closes any whose employee's committed shift has ended.
func CloseExpiredShifts(ctx context.Context, employees *employee.Repo, attendances *attendance.Repo) error {
	open, err := attendances.ListOpen(ctx)
	if err != nil {
		return err
	}
	if len(open) == 0 {
		return nil
	}

	emps, err := employees.List(ctx)
	if err != nil {
		return err
	}
	byID := make(map[string]employee.Employee, len(emps))
	for _, e := range emps {
		byID[e.ID] = e
	}

	now := time.Now()
	for _, l := range open {
		emp, ok := byID[l.EmployeeID]
		if !ok || l.LoginTime == nil {
			continue
		}

		shiftEnd := expectedShiftEnd(emp, l.LogDate, *l.LoginTime)
		if now.Before(shiftEnd) {
			continue
		}
		if err := attendances.AutoClose(ctx, l.ID, shiftEnd); err != nil {
			log.Printf("auto-logout: failed to close log %s: %v", l.ID, err)
		}
	}
	return nil
}

// expectedShiftEnd returns the latest applicable shift-interval end for the
// given log date, falling back to login_time+fallbackOpenShiftHours if the
// employee has no interval configured for that weekday.
func expectedShiftEnd(emp employee.Employee, logDate string, loginTime time.Time) time.Time {
	day, err := time.Parse("2006-01-02", logDate)
	if err != nil {
		return loginTime.Add(fallbackOpenShiftHours * time.Hour)
	}
	weekday := int(day.Weekday())

	var latestEnd time.Time
	found := false
	for _, si := range emp.ShiftIntervals {
		if si.DayOfWeek != nil && *si.DayOfWeek != weekday {
			continue
		}
		end := shiftEndDatetime(day, si.StartTime, si.EndTime)
		if !found || end.After(latestEnd) {
			latestEnd = end
			found = true
		}
	}
	if !found {
		return loginTime.Add(fallbackOpenShiftHours * time.Hour)
	}
	return latestEnd
}

// shiftEndDatetime combines a calendar day with an interval's start/end
// (both "HH:MM"), rolling the end into the next day if it's an overnight
// shift (end <= start).
func shiftEndDatetime(day time.Time, start, end string) time.Time {
	st, err1 := time.Parse("15:04", start)
	et, err2 := time.Parse("15:04", end)
	if err1 != nil || err2 != nil {
		return day.AddDate(0, 0, 1)
	}
	endDatetime := time.Date(day.Year(), day.Month(), day.Day(), et.Hour(), et.Minute(), 0, 0, day.Location())
	startDatetime := time.Date(day.Year(), day.Month(), day.Day(), st.Hour(), st.Minute(), 0, 0, day.Location())
	if !endDatetime.After(startDatetime) {
		endDatetime = endDatetime.AddDate(0, 0, 1)
	}
	return endDatetime
}
