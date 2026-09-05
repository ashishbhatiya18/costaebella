package visibility

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

// ListHidden returns the names of every currently-hidden menu item.
func (r *Repo) ListHidden(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx, `SELECT item_name FROM menuly_hidden_items ORDER BY item_name`)
	if err != nil {
		return nil, fmt.Errorf("query hidden items: %w", err)
	}
	defer rows.Close()

	out := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan hidden item: %w", err)
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

// SetHidden hides or unhides a menu item by name. Hiding upserts a row;
// unhiding deletes it — absence from the table means visible.
func (r *Repo) SetHidden(ctx context.Context, itemName string, hidden bool, hiddenBy string) error {
	if hidden {
		_, err := r.pool.Exec(ctx, `
			INSERT INTO menuly_hidden_items (item_name, hidden_by)
			VALUES ($1, $2)
			ON CONFLICT (item_name) DO UPDATE SET hidden_at = now(), hidden_by = $2`,
			itemName, hiddenBy)
		if err != nil {
			return fmt.Errorf("hide item: %w", err)
		}
		return nil
	}
	_, err := r.pool.Exec(ctx, `DELETE FROM menuly_hidden_items WHERE item_name = $1`, itemName)
	if err != nil {
		return fmt.Errorf("unhide item: %w", err)
	}
	return nil
}
