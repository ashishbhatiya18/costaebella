-- Discounts and complimentary (free) bills on per-sale entries.
-- amount_cents stays what was actually received, so revenue sums are
-- unchanged; the original bill total is amount_cents + discount_cents.
-- A complimentary sale is a ₹0 row that still carries its dishes
-- (ledgerly_sale_items), so the stock it used shows up in Menuly's
-- expected consumption. discount_reason holds the reason for either.
ALTER TABLE ledgerly_sales
    ADD COLUMN discount_cents BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN discount_reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN is_complimentary BOOLEAN NOT NULL DEFAULT false;
