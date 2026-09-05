-- Archive (Active / Archived) for the non-project CRMs — Sales (opportunities),
-- Sales Revenue (revenue opportunities), Marketing (campaigns), Voucher,
-- Investor. Reversible archived_at timestamp, orthogonal to each record's own
-- stage/status. Additive + idempotent + reversible. Null = active.
--
-- Table-existence guarded: some of these CRM tables (e.g. mkt_campaigns) only
-- exist where their module has been migrated. Adding the column only where the
-- table exists keeps this migration safe across prod / staging / dev
-- regardless of which CRMs are provisioned.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crm_opportunities',
    'revenue_opportunities',
    'mkt_campaigns',
    'voucher_entries',
    'investors'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6)', t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I ("archived_at")',
        t || '_archived_at_idx', t
      );
    END IF;
  END LOOP;
END $$;
