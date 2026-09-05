CREATE TABLE shiftly_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL,
    advance_date DATE NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    logged_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shiftly_advances_date ON shiftly_advances (advance_date);
CREATE INDEX idx_shiftly_advances_employee ON shiftly_advances (employee_id);
