-- Marks a supplier as an emergency / quick-commerce source (e.g. Blinkit):
-- bought from only when stock runs out, at a premium. Pantrly's Rate Card
-- keeps these deliveries out of the regular month-on-month rates and lists
-- them separately with the premium paid over the regular rate.
ALTER TABLE pantrly_suppliers ADD COLUMN is_emergency BOOLEAN NOT NULL DEFAULT false;
