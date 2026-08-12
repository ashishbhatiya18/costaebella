package attendance

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNoOpenSession is returned by CloseOpenSession when the employee has no
// open session on the given date to close.
var ErrNoOpenSession = errors.New("no open session to log out from")

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

// InsertSession starts a new login session for the given employee+date. Any
// leave marker for that day is cleared first, since logging in for real
// means they weren't on leave.
func (r *Repo) InsertSession(ctx context.Context, employeeID, date string, loginTime time.Time) (*Log, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		DELETE FROM attendance_logs WHERE employee_id = $1 AND log_date = $2 AND is_leave = true`,
		employeeID, date); err != nil {
		return nil, fmt.Errorf("clear leave marker: %w", err)
	}

	var l Log
	err = tx.QueryRow(ctx, `
		INSERT INTO attendance_logs (employee_id, log_date, login_time)
		VALUES ($1, $2, $3)
		RETURNING id, employee_id, log_date::text, login_time, logout_time, auto_logout, is_leave`,
		employeeID, date, loginTime).Scan(
		&l.ID, &l.EmployeeID, &l.LogDate, &l.LoginTime, &l.LogoutTime, &l.AutoLogout, &l.IsLeave)
	if err != nil {
		return nil, fmt.Errorf("insert session: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return &l, nil
}

// CloseOpenSession closes the most recently opened session for an
// employee+date (the one with the latest login_time and no logout_time
// yet). Returns ErrNoOpenSession if there's nothing open to close.
func (r *Repo) CloseOpenSession(ctx context.Context, employeeID, date string, logoutTime time.Time) (*Log, error) {
	var l Log
	err := r.pool.QueryRow(ctx, `
		UPDATE attendance_logs
		SET logout_time = $3, auto_logout = false, updated_at = now()
		WHERE id = (
			SELECT id FROM attendance_logs
			WHERE employee_id = $1 AND log_date = $2 AND logout_time IS NULL AND login_time IS NOT NULL
			ORDER BY login_time DESC
			LIMIT 1
		)
		RETURNING id, employee_id, log_date::text, login_time, logout_time, auto_logout, is_leave`,
		employeeID, date, logoutTime).Scan(
		&l.ID, &l.EmployeeID, &l.LogDate, &l.LoginTime, &l.LogoutTime, &l.AutoLogout, &l.IsLeave)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNoOpenSession
	}
	if err != nil {
		return nil, fmt.Errorf("close open session: %w", err)
	}
	return &l, nil
}

// ReplaceDay replaces all attendance rows for an employee+date with either a
// single leave marker (isLeave=true, sessions ignored) or the given list of
// sessions. Runs as one transaction so the day is never left inconsistent.
func (r *Repo) ReplaceDay(ctx context.Context, employeeID, date string, sessions []SessionInput, isLeave bool) ([]Log, error) {
	if !isLeave {
		if err := checkSessionOverlaps(sessions); err != nil {
			return nil, err
		}
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM attendance_logs WHERE employee_id = $1 AND log_date = $2`,
		employeeID, date); err != nil {
		return nil, fmt.Errorf("clear day: %w", err)
	}

	var out []Log
	insertOne := func(loginTime *time.Time, logoutTime *time.Time, leave bool) error {
		var l Log
		err := tx.QueryRow(ctx, `
			INSERT INTO attendance_logs (employee_id, log_date, login_time, logout_time, is_leave)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, employee_id, log_date::text, login_time, logout_time, auto_logout, is_leave`,
			employeeID, date, loginTime, logoutTime, leave).Scan(
			&l.ID, &l.EmployeeID, &l.LogDate, &l.LoginTime, &l.LogoutTime, &l.AutoLogout, &l.IsLeave)
		if err != nil {
			return fmt.Errorf("insert row: %w", err)
		}
		out = append(out, l)
		return nil
	}

	if isLeave {
		if err := insertOne(nil, nil, true); err != nil {
			return nil, err
		}
	} else {
		for _, s := range sessions {
			loginTime, err := time.Parse(time.RFC3339, s.LoginTime)
			if err != nil {
				return nil, fmt.Errorf("invalid session login_time: %w", err)
			}
			var logoutTime *time.Time
			if s.LogoutTime != nil && *s.LogoutTime != "" {
				parsed, err := time.Parse(time.RFC3339, *s.LogoutTime)
				if err != nil {
					return nil, fmt.Errorf("invalid session logout_time: %w", err)
				}
				logoutTime = &parsed
			}
			if err := insertOne(&loginTime, logoutTime, false); err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return out, nil
}

// ListRange returns all attendance rows (sessions and/or leave markers) for
// an employee (or all employees if employeeID is empty) between from and to
// (inclusive, YYYY-MM-DD). A given employee+date may appear as multiple
// rows now that split-shift sessions are supported.
func (r *Repo) ListRange(ctx context.Context, employeeID, from, to string) ([]Log, error) {
	query := `
		SELECT id, employee_id, log_date::text, login_time, logout_time, auto_logout, is_leave
		FROM attendance_logs
		WHERE log_date BETWEEN $1 AND $2 AND ($3 = '' OR employee_id::text = $3)
		ORDER BY employee_id, log_date, login_time`

	rows, err := r.pool.Query(ctx, query, from, to, employeeID)
	if err != nil {
		return nil, fmt.Errorf("query logs: %w", err)
	}
	defer rows.Close()

	var out []Log
	for rows.Next() {
		var l Log
		if err := rows.Scan(&l.ID, &l.EmployeeID, &l.LogDate, &l.LoginTime, &l.LogoutTime, &l.AutoLogout, &l.IsLeave); err != nil {
			return nil, fmt.Errorf("scan log: %w", err)
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// ListOpen returns all attendance sessions that have a login_time but no
// logout_time yet, across all employees. Used by the auto-logout reconciler.
func (r *Repo) ListOpen(ctx context.Context) ([]Log, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, employee_id, log_date::text, login_time, logout_time, auto_logout, is_leave
		FROM attendance_logs
		WHERE login_time IS NOT NULL AND logout_time IS NULL`)
	if err != nil {
		return nil, fmt.Errorf("query open logs: %w", err)
	}
	defer rows.Close()

	var out []Log
	for rows.Next() {
		var l Log
		if err := rows.Scan(&l.ID, &l.EmployeeID, &l.LogDate, &l.LoginTime, &l.LogoutTime, &l.AutoLogout, &l.IsLeave); err != nil {
			return nil, fmt.Errorf("scan open log: %w", err)
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// AutoClose sets logout_time and auto_logout=true for a session row, but
// only if it's still open (logout_time IS NULL) — avoids racing a
// concurrent manual logout made between the reconciler's scan and this write.
func (r *Repo) AutoClose(ctx context.Context, id string, logoutTime time.Time) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE attendance_logs
		SET logout_time = $2, auto_logout = true, updated_at = now()
		WHERE id = $1 AND logout_time IS NULL`, id, logoutTime)
	if err != nil {
		return fmt.Errorf("auto-close attendance log: %w", err)
	}
	return nil
}

// RecentActivity returns the most recent login/logout events, newest first,
// optionally filtered to a single employee. Each session row can produce up
// to two activity entries (one for its login_time, one for its
// logout_time). It fetches one extra row beyond limit so callers can detect
// whether more pages are available without a separate count query.
func (r *Repo) RecentActivity(ctx context.Context, employeeID string, limit, offset int) ([]ActivityItem, bool, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT employee_id, employee_name, field, at
		FROM (
			SELECT l.employee_id, e.name AS employee_name, 'login' AS field, l.login_time AS at
			FROM attendance_logs l
			JOIN employees e ON e.id = l.employee_id
			WHERE l.login_time IS NOT NULL
			UNION ALL
			SELECT l.employee_id, e.name AS employee_name, 'logout' AS field, l.logout_time AS at
			FROM attendance_logs l
			JOIN employees e ON e.id = l.employee_id
			WHERE l.logout_time IS NOT NULL
		) activity
		WHERE $3 = '' OR employee_id::text = $3
		ORDER BY at DESC
		LIMIT $1 OFFSET $2`, limit+1, offset, employeeID)
	if err != nil {
		return nil, false, fmt.Errorf("query recent activity: %w", err)
	}
	defer rows.Close()

	var out []ActivityItem
	for rows.Next() {
		var a ActivityItem
		if err := rows.Scan(&a.EmployeeID, &a.EmployeeName, &a.Field, &a.At); err != nil {
			return nil, false, fmt.Errorf("scan activity: %w", err)
		}
		out = append(out, a)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}

	hasMore := len(out) > limit
	if hasMore {
		out = out[:limit]
	}
	return out, hasMore, nil
}

// checkSessionOverlaps validates that no two sessions overlap. Sessions
// where logout is nil (still open) or spans past midnight are treated as
// ending at their logout time (or "now"-ended-ness is the caller's problem —
// this only compares the timestamps given).
func checkSessionOverlaps(sessions []SessionInput) error {
	type parsed struct {
		start time.Time
		end   time.Time
	}
	var ps []parsed
	for _, s := range sessions {
		start, err := time.Parse(time.RFC3339, s.LoginTime)
		if err != nil {
			return fmt.Errorf("invalid session login_time: %w", err)
		}
		end := start.Add(24 * time.Hour) // open session: treat as far future for overlap purposes
		if s.LogoutTime != nil && *s.LogoutTime != "" {
			parsedEnd, err := time.Parse(time.RFC3339, *s.LogoutTime)
			if err != nil {
				return fmt.Errorf("invalid session logout_time: %w", err)
			}
			if !parsedEnd.After(start) {
				return fmt.Errorf("session logout_time must be after login_time")
			}
			end = parsedEnd
		}
		ps = append(ps, parsed{start: start, end: end})
	}

	sort.Slice(ps, func(i, j int) bool { return ps[i].start.Before(ps[j].start) })
	for i := 1; i < len(ps); i++ {
		if ps[i].start.Before(ps[i-1].end) {
			return fmt.Errorf("overlapping sessions")
		}
	}
	return nil
}
