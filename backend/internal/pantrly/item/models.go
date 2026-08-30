package item

import "time"

type Item struct {
	ID        string    `json:"id,omitempty"`
	Name      string    `json:"name"`
	Unit      string    `json:"unit"`
	Category  string    `json:"category"`
	ParLevel  float64   `json:"par_level"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at,omitempty"`
	UpdatedAt time.Time `json:"updated_at,omitempty"`
}
