-- Add Thai-language account name to the chart of accounts. Nullable so
-- existing rows survive the deploy; the importer and the Add Account
-- dialog write it when the source data provides one.

ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "name_th" TEXT;
