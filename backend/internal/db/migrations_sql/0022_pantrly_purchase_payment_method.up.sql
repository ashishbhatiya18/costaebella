-- How a Pantrly delivery was paid for (cash/bank/upi/other — same set as
-- ledgerly_payments.payment_method), so it can fill the Method column when
-- Ledgerly lists deliveries as expenses. Defaults to UPI, including for
-- deliveries recorded before this column existed.
ALTER TABLE pantrly_purchases ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'upi';
