-- Who a discount or complimentary bill was given to. A staff member is
-- linked to their Shiftly employee row (given_to_employee_id); anyone else
-- is a free-text name (given_to). The category of the giveaway stays in
-- discount_reason.
ALTER TABLE ledgerly_sales
    ADD COLUMN given_to TEXT NOT NULL DEFAULT '',
    ADD COLUMN given_to_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- Until now the person was typed into notes after the dish summary
-- ("Dish x1 — Name"), so carry that over for existing giveaways.
UPDATE ledgerly_sales
SET given_to = btrim(split_part(notes, ' — ', 2))
WHERE (is_complimentary OR discount_cents > 0)
  AND position(' — ' IN notes) > 0;
