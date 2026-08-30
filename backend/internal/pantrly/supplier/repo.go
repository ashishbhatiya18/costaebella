package supplier

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

func (r *Repo) List(ctx context.Context) ([]Supplier, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, phone, notes, active, created_at, updated_at
		FROM pantrly_suppliers ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("query suppliers: %w", err)
	}
	defer rows.Close()

	var out []Supplier
	for rows.Next() {
		var s Supplier
		if err := rows.Scan(&s.ID, &s.Name, &s.Phone, &s.Notes, &s.Active, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan supplier: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Repo) Get(ctx context.Context, id string) (*Supplier, error) {
	var s Supplier
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, phone, notes, active, created_at, updated_at
		FROM pantrly_suppliers WHERE id = $1`, id).Scan(
		&s.ID, &s.Name, &s.Phone, &s.Notes, &s.Active, &s.CreatedAt, &s.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get supplier: %w", err)
	}
	return &s, nil
}

func (r *Repo) Create(ctx context.Context, s Supplier) (*Supplier, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO pantrly_suppliers (name, phone, notes, active)
		VALUES ($1, $2, $3, $4) RETURNING id`,
		s.Name, s.Phone, s.Notes, s.Active).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("insert supplier: %w", err)
	}
	return r.Get(ctx, id)
}

func (r *Repo) Update(ctx context.Context, id string, s Supplier) (*Supplier, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE pantrly_suppliers SET name=$1, phone=$2, notes=$3, active=$4, updated_at=now()
		WHERE id=$5`,
		s.Name, s.Phone, s.Notes, s.Active, id)
	if err != nil {
		return nil, fmt.Errorf("update supplier: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, nil
	}
	return r.Get(ctx, id)
}

func (r *Repo) Delete(ctx context.Context, id string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM pantrly_suppliers WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("delete supplier: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}
