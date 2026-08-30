CREATE TABLE ledgerly_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quick end-of-day close-out: one row per day, cash/card/UPI breakdown.
CREATE TABLE ledgerly_revenue_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE NOT NULL UNIQUE,
    cash_cents BIGINT NOT NULL DEFAULT 0,
    card_cents BIGINT NOT NULL DEFAULT 0,
    upi_cents BIGINT NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    logged_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Granular per-sale entries logged individually through the day — many
-- rows per day, unlike the single end-of-day row above. When a day has
-- any rows here, they're the source of truth for that day's revenue.
CREATE TABLE ledgerly_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_date DATE NOT NULL,
    amount_cents BIGINT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    logged_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledgerly_sales_date ON ledgerly_sales (sale_date);

-- One generic ledger for every kind of outgoing payment (restaurant expense,
-- supplier PO, employee salary, or anything else) — category + optional
-- links distinguish the kind, rather than separate tables per type.
CREATE TABLE ledgerly_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    amount_cents BIGINT NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL DEFAULT '',
    payee TEXT NOT NULL DEFAULT '',
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES pantrly_suppliers(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT '',
    logged_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledgerly_payments_date ON ledgerly_payments (payment_date);
