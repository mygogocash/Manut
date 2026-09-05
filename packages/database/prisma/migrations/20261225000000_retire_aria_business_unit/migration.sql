-- Retire the "ARIA" business-unit tag seeded by 20261224000000_crm_business_units.
--
-- ARIA is a MODULE (`/sales-revenue`, its own tables and `sales-revenue:*`
-- permissions), not a way of tagging cards on the Sales board. With ARIA also
-- folded into the Sales CRM sidebar group as a child, the tag produced a second
-- nav entry with the same label — three "ARIA" rows counting the AI assistant.
--
-- Deactivated, NOT deleted, on purpose:
--   • `business_units` is a text[] on crm_/revenue_ records. Deleting the unit
--     runs the service's strip-the-code path and would silently drop tags reps
--     already applied; deactivating leaves every stored value untouched.
--   • The list endpoint filters `is_active = true`, so the unit disappears from
--     the sidebar, the pipeline filter and the form multi-selects immediately.
--   • Cards still carrying the code keep rendering a chip:
--     `labelForBusinessUnitCode` falls back to the raw code ("aria"), which the
--     hook documents as expected — "a record can outlive its tag".
--
-- Reversible: flip is_active back to true to restore the unit and its label.
-- Idempotent: the WHERE clause makes a re-run a no-op, and the row may legitimately
-- be absent (the seed used ON CONFLICT DO NOTHING, so an operator could have
-- removed it by hand).
UPDATE "crm_business_units"
SET "is_active" = false,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'aria'
  AND "is_active" = true;
