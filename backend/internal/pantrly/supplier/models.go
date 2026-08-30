package supplier

import "time"

type Supplier struct {
	ID        string    `json:"id,omitempty"`
	Name      string    `json:"name"`
	Phone     string    `json:"phone"`
	Notes     string    `json:"notes"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at,omitempty"`
	UpdatedAt time.Time `json:"updated_at,omitempty"`
}
