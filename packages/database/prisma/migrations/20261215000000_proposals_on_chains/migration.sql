-- Move proposals onto the configurable approval chain.
--
-- Two fixed tiers become N configurable stages, so the two per-tier statuses
-- collapse into one in-flight status and the position moves to
-- `current_step_order` plus a snapshot in `approval_chain_decisions`.
--
-- The whole point of this migration is that NOTHING IN FLIGHT BREAKS. A proposal
-- mid-review must keep the same next approver it had this morning, and must stay
-- decidable. Without the backfill below, an in-flight proposal would have no
-- snapshot, `canDecide` would answer "not following a chain", and nobody could
-- move it.
--
-- Idempotent: every statement is guarded on the state it changes.

-- ── 1. Backfill the snapshot for anything still in flight ────────────────
--
-- Done BEFORE the status rename, because it reads the old statuses to work out
-- which stage each proposal had reached:
--
--   pending_pm_review     -> stage 1 pending
--   pending_ceo_approval  -> stage 1 approved (it got past the first reviewer),
--                            stage 2 pending
--
-- Terminal proposals get no snapshot. Their history lives in
-- `proposal_transitions` and nothing further will be decided, so inventing
-- decision rows for them would be fabricating a record of who approved what.

DO $$
DECLARE
  v_proposal   record;
  v_step       record;
  v_reached    integer;
  v_seq        integer;
BEGIN
  -- Nothing to do if the chain itself is missing (its migration seeds it).
  IF NOT EXISTS (SELECT 1 FROM "approval_chains" WHERE "scope" = 'proposal') THEN
    RAISE NOTICE 'No proposal chain configured; skipping snapshot backfill';
    RETURN;
  END IF;

  FOR v_proposal IN
    SELECT p."id", p."status"
    FROM "proposals" p
    WHERE p."status" IN ('pending_pm_review', 'pending_ceo_approval')
      -- Guard: never snapshot twice.
      AND NOT EXISTS (
        SELECT 1 FROM "approval_chain_decisions" d WHERE d."proposal_id" = p."id"
      )
  LOOP
    -- Which stage this proposal had already cleared.
    v_reached := CASE WHEN v_proposal.status = 'pending_ceo_approval' THEN 1 ELSE 0 END;
    v_seq := 0;

    FOR v_step IN
      SELECT s."name", s."approver_user_id"
      FROM "approval_chain_steps" s
      JOIN "approval_chains" c ON c."id" = s."chain_id"
      WHERE c."scope" = 'proposal' AND s."is_active" = true
      ORDER BY s."order" ASC
    LOOP
      v_seq := v_seq + 1;
      INSERT INTO "approval_chain_decisions" (
        "id", "scope", "proposal_id", "order", "name",
        "approver_user_id", "status", "decided_at", "notes"
      )
      VALUES (
        gen_random_uuid()::text,
        'proposal',
        v_proposal.id,
        v_seq,
        v_step.name,
        v_step.approver_user_id,
        CASE WHEN v_seq <= v_reached THEN 'approved' ELSE 'pending' END,
        -- Approved-by-backfill rows carry no decider and no timestamp on
        -- purpose: the real decision is in proposal_transitions, and inventing
        -- one here would put a name against something that person never clicked.
        NULL,
        CASE
          WHEN v_seq <= v_reached
          THEN 'Recorded when proposals moved onto configurable approval chains. The original decision is in the proposal history.'
          ELSE NULL
        END
      );
    END LOOP;

    -- Point the proposal at the stage that now owes a decision.
    UPDATE "proposals"
    SET "current_step_order" = v_reached + 1
    WHERE "id" = v_proposal.id AND "current_step_order" IS NULL;
  END LOOP;
END $$;

-- ── 2. Collapse the two in-flight statuses into one ─────────────────────
--
-- `pending_approval` says "somebody owes a decision"; which somebody is the
-- snapshot's job. The old names could not describe stage 3 of 5.
--
-- The code still recognises both old values as in-flight, so this UPDATE is a
-- tidy-up rather than a correctness requirement — a row missed here still works.

UPDATE "proposals"
SET "status" = 'pending_approval'
WHERE "status" IN ('pending_pm_review', 'pending_ceo_approval');

-- Transition history is NOT rewritten. Those rows record what the statuses were
-- called when each decision was taken, and rewriting them would falsify the log.
