-- Employee agreements: HR-managed working agreements, visa documents,
-- passports, etc. Employees view their own; HR/admin manages all.

CREATE TABLE IF NOT EXISTS "employee_agreements" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id"    UUID NOT NULL,
  "type"           VARCHAR(40) NOT NULL,
  "title"          VARCHAR(200) NOT NULL,
  "file_url"       TEXT NOT NULL,
  "file_name"      TEXT NOT NULL,
  "mime_type"      TEXT,
  "file_size"      INTEGER,
  "effective_date" DATE,
  "expiry_date"    DATE,
  "notes"          TEXT,
  "uploaded_by_id" UUID,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_agreements_employee_fk"
    FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "employee_agreements_uploaded_by_fk"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "employee_agreements_employee_idx"
  ON "employee_agreements" ("employee_id");
CREATE INDEX IF NOT EXISTS "employee_agreements_type_idx"
  ON "employee_agreements" ("type");
CREATE INDEX IF NOT EXISTS "employee_agreements_expiry_idx"
  ON "employee_agreements" ("expiry_date");
