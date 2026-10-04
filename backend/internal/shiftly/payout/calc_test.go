package payout

import (
	"testing"
	"time"

	"attendance-app/costaebella-backend/internal/shiftly/attendance"
	"attendance-app/costaebella-backend/internal/shiftly/employee"
)

func mustDate(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse("2006-01-02", s)
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func session(t *testing.T, empID, date string, loginHourUTC, hours float64) attendance.Log {
	t.Helper()
	login := mustDate(t, date).Add(time.Duration(loginHourUTC * float64(time.Hour)))
	logout := login.Add(time.Duration(hours * float64(time.Hour)))
	return attendance.Log{EmployeeID: empID, LogDate: date, LoginTime: &login, LogoutTime: &logout}
}

// TestPayoutAbsentMatchesAttendanceSummary guards the invariant that the
// payout daily breakdown (what the payout PDF counts "Absent days" from) and
// the attendance summary classify every day identically. Modeled on a real
// employee pattern: Sunday weekly-off but works most Sundays, misses Mondays
// and a run of mid/late-month days, has an admin weekly-off override, an
// open (not yet logged out) session, an auto-closed session, and a leave day.
func TestPayoutAbsentMatchesAttendanceSummary(t *testing.T) {
	const id = "emp-rohit"
	e := employee.Employee{
		ID:                  id,
		Name:                "Rohit",
		MonthlyPayCents:     1700000,
		WeeklyOffDays:       []int{0}, // Sunday
		EligibleHoursPerDay: 9,
		StartDate:           "2026-08-01",
	}

	from, to := mustDate(t, "2026-09-01"), mustDate(t, "2026-09-30")

	// Present Tue-Sun except the gaps below; Mondays are never logged.
	absentGaps := map[string]bool{"2026-09-17": true, "2026-09-18": true, "2026-09-19": true}
	var logs []attendance.Log
	for d := from; !d.After(mustDate(t, "2026-09-24")); d = d.AddDate(0, 0, 1) {
		ds := d.Format("2006-01-02")
		if d.Weekday() == time.Monday || absentGaps[ds] || ds == "2026-09-14" {
			continue
		}
		logs = append(logs, session(t, id, ds, 6.5, 3.5), session(t, id, ds, 13, 5))
	}
	// Admin one-off weekly-off override on a Monday (marker row, no session).
	logs = append(logs, attendance.Log{EmployeeID: id, LogDate: "2026-09-21", IsWeeklyOff: true})
	// Leave marker.
	logs = append(logs, attendance.Log{EmployeeID: id, LogDate: "2026-09-14", IsLeave: true})
	// Open session (no logout yet) on an otherwise empty day -> 0h -> absent.
	openLogin := mustDate(t, "2026-09-25").Add(6 * time.Hour)
	logs = append(logs, attendance.Log{EmployeeID: id, LogDate: "2026-09-25", LoginTime: &openLogin})
	// Auto-closed (reconcile) session counts as worked hours -> present.
	auto := session(t, id, "2026-09-26", 6, 16)
	auto.AutoLogout = true
	logs = append(logs, auto)
	// Another employee's row on an absent day must not leak in.
	logs = append(logs, session(t, "someone-else", "2026-09-29", 6, 9))

	defer func(orig func() time.Time) { now = orig }(now)
	now = func() time.Time { return mustDate(t, "2026-10-01") }

	avail := ComputeAvailability(e, logs, from, to)
	pay := ComputeHourlyPayout(e, logs, from, to, 0)

	// The admin's one-off weekly-off override is paid as an eligible day,
	// not shown as Rs 0.
	for _, p := range pay.DailyBreakdown {
		if p.Date == "2026-09-21" && (p.PaidOffHours != 9 || p.DayPayCents != 56667) {
			t.Errorf("override weekly off: paid off %v h, pay %d; want 9 h, 56667 (Rs 17,000 / 30 days in Sep)", p.PaidOffHours, p.DayPayCents)
		}
	}

	if len(avail.Days) != len(pay.DailyBreakdown) {
		t.Fatalf("day count mismatch: availability %d, payout %d", len(avail.Days), len(pay.DailyBreakdown))
	}
	countA, countP := map[string]int{}, map[string]int{}
	for i, a := range avail.Days {
		p := pay.DailyBreakdown[i]
		if a.Date != p.Date || a.Category != p.Category {
			t.Errorf("%s: attendance summary=%q, payout=%q", a.Date, a.Category, p.Category)
		}
		countA[a.Category]++
		countP[p.Category]++
		if p.Category == CategoryAbsent && p.DayPayCents != 0 {
			t.Errorf("%s: absent day paid %d", p.Date, p.DayPayCents)
		}
	}

	// Sep 2026 Mondays are 7, 14 (leave), 21 (override), 28 -> absent
	// Mondays: 7, 28. Plus the 17-19 gap, 25 (open session only), and
	// 29-30 (no logs). Sunday 27 has no log -> weekly_off.
	wantAbsent := []string{"2026-09-07", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-25", "2026-09-28", "2026-09-29", "2026-09-30"}
	if countP[CategoryAbsent] != len(wantAbsent) {
		t.Errorf("payout absent days = %d, want %d (counts %v)", countP[CategoryAbsent], len(wantAbsent), countP)
	}
	for _, ds := range wantAbsent {
		for _, p := range pay.DailyBreakdown {
			if p.Date == ds && p.Category != CategoryAbsent {
				t.Errorf("%s: payout category %q, want absent", ds, p.Category)
			}
		}
	}
	if countA[CategoryAbsent] != countP[CategoryAbsent] {
		t.Errorf("absent count: attendance summary %d, payout %d", countA[CategoryAbsent], countP[CategoryAbsent])
	}
	for ds, want := range map[string]string{
		"2026-09-14": CategoryLeave,
		"2026-09-21": CategoryWeeklyOff,
		"2026-09-26": CategoryPresent,
		"2026-09-27": CategoryWeeklyOff,
		"2026-09-06": CategoryPresent, // worked Sunday
	} {
		for _, p := range pay.DailyBreakdown {
			if p.Date == ds && p.Category != want {
				t.Errorf("%s: payout category %q, want %q", ds, p.Category, want)
			}
		}
	}
}

// TestPayoutMonthDaysRateWithPaidWeeklyOff checks the rate is based on the
// month's calendar days, unworked weekly offs are paid as a full eligible
// day, and a worked weekly off is paid for hours worked only (a swap).
func TestPayoutMonthDaysRateWithPaidWeeklyOff(t *testing.T) {
	const id = "emp-a"
	e := employee.Employee{
		ID:                  id,
		Name:                "A",
		MonthlyPayCents:     3000000, // Rs 30,000
		WeeklyOffDays:       []int{0},
		EligibleHoursPerDay: 10,
		StartDate:           "2026-01-01",
	}
	from, to := mustDate(t, "2026-09-01"), mustDate(t, "2026-09-30")

	var logs []attendance.Log
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		if d.Weekday() != time.Sunday {
			logs = append(logs, session(t, id, d.Format("2006-01-02"), 4, 10))
		}
	}
	// Worked one weekly off (Sun 6 Sep), 11h.
	logs = append(logs, session(t, id, "2026-09-06", 4, 11))

	defer func(orig func() time.Time) { now = orig }(now)

	now = func() time.Time { return mustDate(t, "2026-10-01") }
	pay := ComputeHourlyPayout(e, logs, from, to, 0)
	if pay.HourlyRateCents != 10000 {
		t.Fatalf("hourly rate = %v, want 10000 (Rs 30,000 / 30 days in Sep / 10)", pay.HourlyRateCents)
	}
	if pay.PaidOffHours != 30 {
		t.Errorf("paid off hours = %v, want 30 (3 unworked Sundays x 10)", pay.PaidOffHours)
	}
	// 26 working days x 10h + 3 paid offs x 10h + 11h on the worked Sunday = 301h.
	if pay.GrossPayCents != 3010000 {
		t.Errorf("gross = %d, want 3010000", pay.GrossPayCents)
	}
	for _, d := range pay.DailyBreakdown {
		if d.Date == "2026-09-06" && (d.DayPayCents != 110000 || d.PaidOffHours != 0 || d.OvertimeHours != 1) {
			t.Errorf("worked Sunday: pay %d, off %v, OT %v; want 110000 (11h only), 0, +1", d.DayPayCents, d.PaidOffHours, d.OvertimeHours)
		}
		if d.Date == "2026-09-07" && d.OvertimeHours != 0 {
			t.Errorf("regular 10h day OT = %v, want 0", d.OvertimeHours)
		}
	}

	// Mid-month: Sundays after "today" are not credited yet.
	now = func() time.Time { return mustDate(t, "2026-09-15") }
	pay = ComputeHourlyPayout(e, logs, from, to, 0)
	if pay.PaidOffHours != 10 {
		t.Errorf("mid-month paid off hours = %v, want 10 (Sunday 13; 6 was worked)", pay.PaidOffHours)
	}
}

// TestPayoutRateUsesDaysInMonth checks a 31-day month gets a lower hourly
// rate than a 30-day one, so full attendance pays exactly the monthly pay.
func TestPayoutRateUsesDaysInMonth(t *testing.T) {
	const id = "emp-b"
	e := employee.Employee{
		ID:                  id,
		Name:                "B",
		MonthlyPayCents:     3100000, // Rs 31,000
		WeeklyOffDays:       []int{0},
		EligibleHoursPerDay: 10,
		StartDate:           "2026-01-01",
	}
	from, to := mustDate(t, "2026-10-01"), mustDate(t, "2026-10-31")

	var logs []attendance.Log
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		if d.Weekday() != time.Sunday {
			logs = append(logs, session(t, id, d.Format("2006-01-02"), 4, 10))
		}
	}

	defer func(orig func() time.Time) { now = orig }(now)
	now = func() time.Time { return mustDate(t, "2026-11-01") }
	pay := ComputeHourlyPayout(e, logs, from, to, 0)
	if pay.RateBasisDays != 31 || pay.HourlyRateCents != 10000 {
		t.Fatalf("basis %d days, rate %v; want 31 days, 10000", pay.RateBasisDays, pay.HourlyRateCents)
	}
	if pay.GrossPayCents != e.MonthlyPayCents {
		t.Errorf("full-attendance gross = %d, want monthly pay %d", pay.GrossPayCents, e.MonthlyPayCents)
	}
}
