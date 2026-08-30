package employee

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	employees, err := h.repo.List(r.Context())
	if err != nil {
		http.Error(w, "failed to list employees", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, employees)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	e, err := h.repo.Get(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to fetch employee", http.StatusInternalServerError)
		return
	}
	if e == nil {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, e)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var e Employee
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := validateEmployee(e); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	e.Active = true
	created, err := h.repo.Create(r.Context(), e)
	if err != nil {
		http.Error(w, "failed to create employee", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var e Employee
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := validateEmployee(e); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	updated, err := h.repo.Update(r.Context(), id, e)
	if err != nil {
		http.Error(w, "failed to update employee", http.StatusInternalServerError)
		return
	}
	if updated == nil {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ok, err := h.repo.Delete(r.Context(), id)
	if err != nil {
		http.Error(w, "failed to delete employee", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// validateEmployee checks basic invariants, including that shift intervals
// for the same day (or the "every day" nil group) do not overlap.
func validateEmployee(e Employee) error {
	if strings.TrimSpace(e.Name) == "" {
		return fmt.Errorf("name is required")
	}
	if _, err := time.Parse("2006-01-02", e.StartDate); err != nil {
		return fmt.Errorf("start_date must be a valid date (YYYY-MM-DD)")
	}

	byDay := map[int][]ShiftInterval{}
	var everyDay []ShiftInterval
	for _, si := range e.ShiftIntervals {
		if si.StartTime == si.EndTime {
			return fmt.Errorf("shift interval start_time must not equal end_time")
		}
		if si.DayOfWeek == nil {
			everyDay = append(everyDay, si)
		} else {
			byDay[*si.DayOfWeek] = append(byDay[*si.DayOfWeek], si)
		}
	}

	if err := checkOverlaps(everyDay); err != nil {
		return err
	}
	if hrs := totalHours(everyDay); hrs > maxDailyShiftHours {
		return fmt.Errorf("total shift hours (every day) is %.1fh, exceeding the %gh maximum", hrs, maxDailyShiftHours)
	}
	for day, intervals := range byDay {
		combined := append(append([]ShiftInterval{}, intervals...), everyDay...)
		if err := checkOverlaps(combined); err != nil {
			return fmt.Errorf("day %d: %w", day, err)
		}
		if hrs := totalHours(combined); hrs > maxDailyShiftHours {
			return fmt.Errorf("day %d: total shift hours is %.1fh, exceeding the %gh maximum", day, hrs, maxDailyShiftHours)
		}
	}
	return nil
}

// maxDailyShiftHours is the hard cap on an employee's total configured
// shift hours for any single day.
const maxDailyShiftHours = 15.0

// totalHours sums the duration of a set of shift intervals, treating
// end<=start as an overnight shift.
func totalHours(intervals []ShiftInterval) float64 {
	var total float64
	for _, si := range intervals {
		start := minutesOf(si.StartTime)
		end := minutesOf(si.EndTime)
		if end <= start {
			end += 24 * 60
		}
		total += float64(end-start) / 60.0
	}
	return total
}

// checkOverlaps validates that no two intervals overlap within the same day.
// Intervals where end_time <= start_time (e.g. 16:00-00:00 or 23:00-05:00)
// are treated as overnight shifts that run past midnight.
func checkOverlaps(intervals []ShiftInterval) error {
	sorted := append([]ShiftInterval{}, intervals...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].StartTime < sorted[j].StartTime })
	for i := 1; i < len(sorted); i++ {
		prevEnd := minutesOf(sorted[i-1].EndTime)
		prevStart := minutesOf(sorted[i-1].StartTime)
		if prevEnd <= prevStart {
			prevEnd += 24 * 60
		}
		if minutesOf(sorted[i].StartTime) < prevEnd {
			return fmt.Errorf("overlapping shift intervals: %s-%s and %s-%s",
				sorted[i-1].StartTime, sorted[i-1].EndTime, sorted[i].StartTime, sorted[i].EndTime)
		}
	}
	return nil
}

func minutesOf(hhmm string) int {
	var h, m int
	fmt.Sscanf(hhmm, "%d:%d", &h, &m)
	return h*60 + m
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
