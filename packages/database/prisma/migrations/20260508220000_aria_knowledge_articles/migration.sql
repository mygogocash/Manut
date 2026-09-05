-- ARIA knowledge corpus — curated articles injected into the chat
-- system prompt at runtime. v1 uses keyword retrieval; future
-- iterations may swap to vector embeddings without changing the table
-- shape. Idempotent: safe to re-run after a partial-apply incident.

CREATE TABLE IF NOT EXISTS "aria_knowledge_articles" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "category"        TEXT         NOT NULL,
  "title"           TEXT         NOT NULL,
  "slug"            TEXT         NOT NULL,
  "body"            TEXT         NOT NULL,
  "keywords"        TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tags"            TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active"       BOOLEAN      NOT NULL DEFAULT true,
  "created_by_id"   UUID,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "aria_knowledge_articles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "aria_knowledge_articles_slug_key"
  ON "aria_knowledge_articles"("slug");
CREATE INDEX IF NOT EXISTS "aria_knowledge_articles_category_is_active_idx"
  ON "aria_knowledge_articles"("category", "is_active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'aria_knowledge_articles_created_by_id_fkey'
  ) THEN
    ALTER TABLE "aria_knowledge_articles"
      ADD CONSTRAINT "aria_knowledge_articles_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Seed three starter immigration articles per legal-team feedback.
-- Idempotent via the unique slug constraint.
INSERT INTO "aria_knowledge_articles"
  ("id", "category", "title", "slug", "body", "keywords", "tags", "is_active", "updated_at")
VALUES
  (
    gen_random_uuid(),
    'immigration',
    '90-day residence notification (Thailand)',
    '90-day-residence-notification',
    $body$
Thailand requires foreign nationals on long-stay visas to report their address to Immigration every 90 days. Reporting window:
- 15 days BEFORE the due date, or
- up to 7 days AFTER the due date.

How to calculate the due date:
- Start from the latest arrival date stamped in the passport, OR
- Start from the date of the previous 90-day report.
- Add 89 days. The resulting date is the 90-day report due date.

Channels:
- In-person at the local Immigration office.
- Online via the e-Service portal at https://tm47.immigration.go.th (recommended for routine reports).
- By post (allow at least 15 days before the due date).

Common pitfalls:
- The 90-day clock resets on every international entry into Thailand. Always recalculate after any trip out.
- Late reporting fines: 2,000 THB on the spot, up to 4,000 THB if HR has to escalate.

Trigger this article for any question about: 90-day report, TM47, residence notification, address report, immigration check-in.
$body$,
    ARRAY['90-day','90 day','tm47','residence notification','address report','immigration check-in','re-report'],
    ARRAY['thailand','immigration'],
    true,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'immigration',
    'Re-Entry Permit (Thailand)',
    're-entry-permit-thailand',
    $body$
A Re-Entry Permit (single or multiple) preserves the validity of an existing Thai visa when leaving Thailand. Without it, the visa is automatically void on departure and the person must apply for a new visa abroad.

When to apply:
- BEFORE leaving Thailand. The permit cannot be issued from outside the country.

Where to apply:
- Suvarnabhumi / Don Mueang airport Immigration counters (same day, before departure).
- Local Immigration offices (1–2 business days).

Documents required:
- Valid passport with the current visa stamp.
- TM.8 application form (downloadable from the Immigration website).
- One passport photo (4 x 6 cm, white background).
- Fee: 1,000 THB single re-entry, 3,800 THB multiple re-entry.

Common pitfalls:
- A single re-entry permit covers exactly one trip. Multiple re-entry covers any number of trips during the visa's validity.
- The Re-Entry Permit does NOT extend the visa expiry — it only preserves it.
- If the trip out is unplanned, the airport counter route is the fastest.

Trigger this article for any question about: re-entry permit, TM.8, leaving Thailand, preserving visa, re-entry stamp.
$body$,
    ARRAY['re-entry','reentry','re entry','tm.8','tm8','leaving thailand','preserve visa','single re-entry','multiple re-entry'],
    ARRAY['thailand','immigration'],
    true,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'immigration',
    'Visa expiry calculation rules of thumb',
    'visa-expiry-calculation',
    $body$
Quick rules for calculating visa-related deadlines on Thai long-stay permits:

- 90-day report: latest arrival or last report + 89 days. Window opens 15 days before, closes 7 days after.
- Re-Entry Permit: must be issued BEFORE departure; without one, the visa voids on exit.
- Visa extension: file at the local Immigration office at least 7 working days before expiry. Bring the latest TM.6 (departure card) and the original passport.
- Work Permit (BOI vs non-BOI):
  - BOI WP: renewed in batches via the BOI portal, generally 30 days before expiry.
  - Non-BOI WP: renewed in person at the Department of Employment with the standard supporting documents (employment contract, education certificates, recent photos).

For each foreign employee, HR should track three dates: visa expiry, work-permit expiry, and the next 90-day report. The Visa module in the intranet surfaces all three with renewal-window alerts.

Trigger this article for any question about: visa expiry, visa extension, calculating dates, +89 days, deadlines, renewal window.
$body$,
    ARRAY['visa expiry','visa extension','calculate due date','89 days','renewal window','work permit','wp','boi','non-boi'],
    ARRAY['thailand','immigration'],
    true,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO NOTHING;
