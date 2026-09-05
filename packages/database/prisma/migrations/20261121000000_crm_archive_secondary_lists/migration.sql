-- Archive (Active / Archived) for the SECONDARY CRM lists — the account /
-- contact / lead records of Sales, Sales Revenue, and Investor CRMs. Mirrors
-- the primary-record archive (opportunities / investors). Reversible
-- archived_at timestamp, orthogonal to each record's own status/stage.
-- Additive + idempotent + reversible. NULL = active.
--
-- Table-existence guarded (see 20261119): only touches tables that exist in
-- the target environment, so it's safe across prod / staging / dev.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crm_accounts',
    'crm_contacts',
    'crm_leads',
    'revenue_accounts',
    'revenue_contacts',
    'revenue_leads',
    'investor_accounts',
    'investor_contacts',
    'investor_leads'
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
