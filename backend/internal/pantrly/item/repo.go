package item

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

func (r *Repo) List(ctx context.Context) ([]Item, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, unit, category, par_level, active, created_at, updated_at
		FROM pantrly_items ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("query items: %w", err)
	}
	defer rows.Close()

	var out []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.Name, &it.Unit, &it.Category, &it.ParLevel, &it.Active, &it.CreatedAt, &it.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan item: %w", err)
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

func (r *Repo) Get(ctx context.Context, id string) (*Item, error) {
	var it Item
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, unit, category, par_level, active, created_at, updated_at
		FROM pantrly_items WHERE id = $1`, id).Scan(
		&it.ID, &it.Name, &it.Unit, &it.Category, &it.ParLevel, &it.Active, &it.CreatedAt, &it.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get item: %w", err)
	}
	return &it, nil
}

func (r *Repo) Create(ctx context.Context, it Item) (*Item, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO pantrly_items (name, unit, category, par_level, active)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		it.Name, it.Unit, it.Category, it.ParLevel, it.Active).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("insert item: %w", err)
	}
	return r.Get(ctx, id)
}

func (r *Repo) Update(ctx context.Context, id string, it Item) (*Item, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE pantrly_items SET name=$1, unit=$2, category=$3, par_level=$4, active=$5, updated_at=now()
		WHERE id=$6`,
		it.Name, it.Unit, it.Category, it.ParLevel, it.Active, id)
	if err != nil {
		return nil, fmt.Errorf("update item: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, nil
	}
	return r.Get(ctx, id)
}

func (r *Repo) Delete(ctx context.Context, id string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM pantrly_items WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("delete item: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}
