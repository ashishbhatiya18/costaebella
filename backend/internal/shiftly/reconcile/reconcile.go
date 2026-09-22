// Package reconcile periodically closes out attendance logs that were never
// manually logged out, so a forgotten logout doesn't leave an employee stuck
// "logged in" indefinitely and skewing hours-worked/payout calculations.
package reconcile

import (
	"context"
	"log"
	"time"

	"attendance-app/costaebella-backend/internal/shiftly/attendance"
	"attendance-app/costaebella-backend/internal/shiftly/employee"
)

// fallbackOpenShiftHours is how long an open session is left running before
// it's auto-closed — employees no longer have fixed shift start/end times,
// so this is a flat safety cutoff rather than a per-shift lookup.
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
// auto-closes any open longer than fallbackOpenShiftHours.
func CloseExpiredShifts(ctx context.Context, employees *employee.Repo, attendances *attendance.Repo) error {
	open, err := attendances.ListOpen(ctx)
	if err != nil {
		return err
	}
	if len(open) == 0 {
		return nil
	}

	now := time.Now()
	for _, l := range open {
		if l.LoginTime == nil {
			continue
		}
		shiftEnd := l.LoginTime.Add(fallbackOpenShiftHours * time.Hour)
		if now.Before(shiftEnd) {
			continue
		}
		if err := attendances.AutoClose(ctx, l.ID, shiftEnd); err != nil {
			log.Printf("auto-logout: failed to close log %s: %v", l.ID, err)
		}
	}
	return nil
}
