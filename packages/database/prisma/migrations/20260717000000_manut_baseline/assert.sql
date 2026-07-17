DO $$
BEGIN
  IF to_regclass('public.users') IS NULL
    OR to_regclass('public.roles') IS NULL
    OR to_regclass('public.entities') IS NULL
    OR to_regclass('public.leave_requests') IS NULL
    OR to_regclass('public.expense_reports') IS NULL THEN
    RAISE EXCEPTION 'Manut baseline is missing a required core table';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'balance_transactions'
      AND column_name = 'amount'
      AND data_type = 'numeric'
      AND numeric_precision = 4
      AND numeric_scale = 1
  ) THEN
    RAISE EXCEPTION 'balance_transactions.amount must preserve half-day precision';
  END IF;

END
$$;
