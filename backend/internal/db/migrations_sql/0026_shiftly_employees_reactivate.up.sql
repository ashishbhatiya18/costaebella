-- Editing an employee used to write active = false, because the edit form
-- never sends the field (fixed in employee.Repo.Update). Nothing else ever
-- deactivates an employee, so every inactive row got that way through the
-- bug — restore them.
UPDATE employees SET active = true WHERE NOT active;
