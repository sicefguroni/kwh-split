-- Normalize databases bootstrapped from the legacy root schema.sql snapshot.
-- That snapshot created `expensers`, pointed split/receipt FKs at it, and used
-- `receipt_items_assignments` instead of the canonical `receipt_item_assignments`.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'expensers'
  ) THEN
    INSERT INTO expenses (
      expense_id,
      group_id,
      title_description,
      total_amount,
      sale_date,
      tax_amount,
      tip_amount,
      split_type,
      receipt_items_flag,
      receipt_image_url,
      created_at,
      updated_at,
      payer_user_id,
      category,
      note
    )
    SELECT
      legacy.expense_id,
      legacy.group_id,
      legacy.title_description,
      legacy.total_amount,
      legacy.sale_date,
      COALESCE(legacy.tax_amount, 0.00),
      COALESCE(legacy.tip_amount, 0.00),
      COALESCE(legacy.split_type, 'equal'),
      COALESCE(legacy.receipt_items_flag, FALSE),
      legacy.receipt_image_url,
      COALESCE(legacy.created_at, CURRENT_TIMESTAMP),
      COALESCE(legacy.updated_at, CURRENT_TIMESTAMP),
      NULL,
      'General',
      ''
    FROM expensers legacy
    WHERE NOT EXISTS (
      SELECT 1
      FROM expenses canonical
      WHERE canonical.expense_id = legacy.expense_id
    );

    PERFORM setval(
      pg_get_serial_sequence('expenses', 'expense_id'),
      GREATEST(COALESCE((SELECT MAX(expense_id) FROM expenses), 0), 1),
      TRUE
    );
  END IF;
END $$;

ALTER TABLE expense_splits
  DROP CONSTRAINT IF EXISTS fk_expense_splits_expense;

ALTER TABLE expense_splits
  ADD CONSTRAINT fk_expense_splits_expense
  FOREIGN KEY (expense_id) REFERENCES expenses(expense_id) ON DELETE CASCADE;

ALTER TABLE receipt_items
  DROP CONSTRAINT IF EXISTS fk_receipt_items_expense;

ALTER TABLE receipt_items
  ADD CONSTRAINT fk_receipt_items_expense
  FOREIGN KEY (expense_id) REFERENCES expenses(expense_id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'receipt_items_assignments'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'receipt_item_assignments'
    ) THEN
      INSERT INTO receipt_item_assignments (
        assignment_id,
        item_id,
        user_id,
        created_at,
        updated_at
      )
      SELECT
        legacy.assignment_id,
        legacy.item_id,
        legacy.user_id,
        legacy.created_at,
        legacy.updated_at
      FROM receipt_items_assignments legacy
      ON CONFLICT DO NOTHING;

      DROP TABLE receipt_items_assignments;
    ELSE
      ALTER TABLE receipt_items_assignments RENAME TO receipt_item_assignments;
    END IF;

    PERFORM setval(
      pg_get_serial_sequence('receipt_item_assignments', 'assignment_id'),
      GREATEST(COALESCE((SELECT MAX(assignment_id) FROM receipt_item_assignments), 0), 1),
      TRUE
    );
  END IF;
END $$;
