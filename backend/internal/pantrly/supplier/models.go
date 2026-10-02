package supplier

import "time"

type Supplier struct {
	ID     string `json:"id,omitempty"`
	Name   string `json:"name"`
	Phone  string `json:"phone"`
	Notes  string `json:"notes"`
	Active bool   `json:"active"`
	// IsEmergency marks an emergency / quick-commerce source (e.g. Blinkit),
	// bought from only when stock runs out. The Rate Card reports these
	// deliveries separately instead of mixing them into regular rates.
	IsEmergency bool      `json:"is_emergency"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`
}
