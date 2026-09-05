-- The "recipe" for a menu item: how much of each Pantrly item one order of
-- it consumes. item_name is free text (matched against frontend/data/menu.yaml
-- item names, same as ledgerly_sale_items) since menu items aren't modeled
-- in the database; pantrly_item_id is a real FK since Pantrly items already
-- are. Used to compute expected ingredient consumption from Ledgerly's
-- tagged sales, for comparison against Pantrly's actual counted consumption.
CREATE TABLE menuly_item_composition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name TEXT NOT NULL,
    pantrly_item_id UUID NOT NULL REFERENCES pantrly_items(id) ON DELETE CASCADE,
    quantity_per_order NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (item_name, pantrly_item_id)
);
CREATE INDEX idx_menuly_item_composition_item ON menuly_item_composition (item_name);
