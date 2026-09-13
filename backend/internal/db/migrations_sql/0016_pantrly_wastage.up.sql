CREATE TABLE pantrly_wastage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES pantrly_items(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    wastage_date DATE NOT NULL,
    logged_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pantrly_wastage_logs_item_date ON pantrly_wastage_logs (item_id, wastage_date);
