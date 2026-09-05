-- Mark the originally-decided stages of each chain as fixed.
--
-- The shape of an approval is not an administrator's to delete — only to staff.
-- A system stage can be renamed and reassigned, which is the whole point of the
-- chain being configurable, but it cannot be removed or parked. Stages added
-- afterwards are ordinary and can be deleted freely.
--
-- Additive and idempotent.

ALTER TABLE "approval_chain_steps"
  ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false;

-- Which stages count as originally-decided?
--
-- The seed in 20261214000000 inserted each chain and its stages in ONE
-- statement block, so `now()` — and therefore `created_at` — is identical for a
-- chain and the stages it shipped with. Anything an administrator added later
-- carries a later timestamp. Matching on that marks exactly the seeded stages.
--
-- The blunter rule "mark everything that exists" was wrong: a chain an admin had
-- already extended would have had that extra stage frozen too, and no admin
-- could then remove a stage they themselves added.
--
-- Only ever sets false -> true, and re-selects the same rows on a re-run, so
-- this is safe to apply repeatedly.
UPDATE "approval_chain_steps" s
SET "is_system" = true
FROM "approval_chains" c
WHERE c."id" = s."chain_id"
  AND s."is_system" = false
  AND s."created_at" = c."created_at";
