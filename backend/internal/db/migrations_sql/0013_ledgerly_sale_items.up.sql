-- Tags a per-sale entry with the menu item(s) it was for, so Menuly can
-- later compute per-dish revenue/popularity from Ledgerly's sales data.
-- item_name is free text (matched against frontend/data/menu.yaml item
-- names at entry time) rather than a foreign key, since menu items aren't
-- modeled in the database yet.
CREATE TABLE ledgerly_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES ledgerly_sales(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledgerly_sale_items_sale ON ledgerly_sale_items (sale_id);
CREATE INDEX idx_ledgerly_sale_items_name ON ledgerly_sale_items (item_name);
