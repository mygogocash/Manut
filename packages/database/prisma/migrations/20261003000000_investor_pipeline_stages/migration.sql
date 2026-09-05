-- Configurable Investor pipeline stages + new leftmost "Investors" intake
-- column. Idempotent: CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS "investor_pipeline_stages" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'border-t-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investor_pipeline_stages_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "investor_pipeline_stages_sort_order_idx" ON "investor_pipeline_stages"("sort_order");

-- Seed the default stage set. "investors" is the new leftmost intake
-- column; the original seven follow. Colours match the board's
-- border-t-* palette.
INSERT INTO "investor_pipeline_stages" ("key", "label", "color", "sort_order", "updated_at") VALUES
    ('investors',               'Investors',                            'border-t-zinc-500',    0, CURRENT_TIMESTAMP),
    ('lead',                    'Lead',                                 'border-t-slate-500',   1, CURRENT_TIMESTAMP),
    ('discovery_call',          'Discovery Call / Ongoing Communication','border-t-blue-500',   2, CURRENT_TIMESTAMP),
    ('dd',                      'DD',                                   'border-t-violet-500',  3, CURRENT_TIMESTAMP),
    ('verbal_commitment',       'Verbal Commitment',                    'border-t-amber-500',   4, CURRENT_TIMESTAMP),
    ('agreement_signed',        'Agreement Signed',                     'border-t-purple-500',  5, CURRENT_TIMESTAMP),
    ('funds_cleared',           'Funds Cleared',                        'border-t-emerald-500', 6, CURRENT_TIMESTAMP),
    ('relationship_management', 'Relationship Management',              'border-t-teal-500',    7, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Move every current investor (all sit in 'lead' today) into the new
-- 'investors' intake column.
UPDATE "investors" SET "status" = 'investors' WHERE "status" = 'lead';

-- New investors default to the intake column going forward.
ALTER TABLE "investors" ALTER COLUMN "status" SET DEFAULT 'investors';
