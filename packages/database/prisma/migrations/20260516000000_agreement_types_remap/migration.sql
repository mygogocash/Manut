-- Remap legacy agreement type codes to the new enum values.
-- Old: working_agreement | visa | nda | offer_letter | tax
-- New: employment_contract | contract_amendment | equity_agreement |
--      passport | id_card | work_permit | work_visa | other_visas |
--      tax_id | other
-- Anything that doesn't map cleanly stays as "other" so the rows
-- remain visible to admins.

UPDATE "employee_agreements" SET "type" = 'employment_contract'
  WHERE "type" = 'working_agreement';
UPDATE "employee_agreements" SET "type" = 'work_visa' WHERE "type" = 'visa';
UPDATE "employee_agreements" SET "type" = 'tax_id' WHERE "type" = 'tax';
UPDATE "employee_agreements" SET "type" = 'other' WHERE "type" = 'nda';
UPDATE "employee_agreements" SET "type" = 'other' WHERE "type" = 'offer_letter';
