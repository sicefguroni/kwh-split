ALTER TABLE expense_splits
  ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2);

UPDATE expense_splits
  SET original_amount = amount_owed
  WHERE original_amount IS NULL;
