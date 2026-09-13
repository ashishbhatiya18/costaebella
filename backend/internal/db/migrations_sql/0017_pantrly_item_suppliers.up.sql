CREATE TABLE pantrly_item_suppliers (
    item_id UUID NOT NULL REFERENCES pantrly_items(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES pantrly_suppliers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (item_id, supplier_id)
);
