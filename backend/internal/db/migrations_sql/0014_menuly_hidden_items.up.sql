-- Menu items themselves stay in frontend/data/menu.yaml (source of truth
-- for name/price/description, baked in at build time). This table only
-- tracks which items are currently hidden ("86'd") from the live public
-- menu — a menu item's absence from this table means it's visible.
CREATE TABLE menuly_hidden_items (
    item_name TEXT PRIMARY KEY,
    hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    hidden_by TEXT NOT NULL DEFAULT ''
);
