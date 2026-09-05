-- AlterTable
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "sub_type" TEXT;

-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "source_ref" TEXT,
ADD COLUMN IF NOT EXISTS "source_type" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "amount_paid" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "vendor_id" UUID;

-- AlterTable
ALTER TABLE "bank_transactions" ADD COLUMN IF NOT EXISTS "bank_account_id" TEXT,
ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "direction" TEXT,
ADD COLUMN IF NOT EXISTS "reconciled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "reconciled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bank_accounts" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'bank',
    "account_number" TEXT,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'THB',
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gl_account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "bank_account_id" TEXT,
    "date" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'bank-transfer',
    "wht_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "linked_je_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quotes" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "quote_no" TEXT NOT NULL,
    "vendor_id" UUID,
    "issue_date" DATE NOT NULL,
    "expiry_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'THB',
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "converted_invoice_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quote_lines" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_code_id" TEXT,
    "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gl_account_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "po_no" TEXT NOT NULL,
    "vendor_id" UUID,
    "order_date" DATE NOT NULL,
    "expected_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'THB',
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "converted_invoice_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "po_lines" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL DEFAULT 1,
    "qty_received" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_code_id" TEXT,
    "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gl_account_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "po_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "credit_notes" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "credit_note_no" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "vendor_id" UUID,
    "linked_invoice_id" TEXT,
    "issue_date" DATE NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "linked_je_id" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "credit_note_lines" (
    "id" TEXT NOT NULL,
    "credit_note_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_code_id" TEXT,
    "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gl_account_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tax_codes" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "gl_account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "account_mappings" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "chart_of_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_sequences" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "pad_width" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bank_accounts_entity_id_is_active_idx" ON "bank_accounts"("entity_id", "is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bank_accounts_deleted_at_idx" ON "bank_accounts"("deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_entity_id_idx" ON "payments"("entity_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_deleted_at_idx" ON "payments"("deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotes_entity_id_status_idx" ON "quotes"("entity_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotes_deleted_at_idx" ON "quotes"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_entity_id_quote_no_key" ON "quotes"("entity_id", "quote_no");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quote_lines_quote_id_idx" ON "quote_lines"("quote_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_orders_entity_id_status_idx" ON "purchase_orders"("entity_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_orders_deleted_at_idx" ON "purchase_orders"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_entity_id_po_no_key" ON "purchase_orders"("entity_id", "po_no");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "po_lines_po_id_idx" ON "po_lines"("po_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "credit_notes_entity_id_status_idx" ON "credit_notes"("entity_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "credit_notes_deleted_at_idx" ON "credit_notes"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_entity_id_credit_note_no_key" ON "credit_notes"("entity_id", "credit_note_no");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "credit_note_lines_credit_note_id_idx" ON "credit_note_lines"("credit_note_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tax_codes_entity_id_code_key" ON "tax_codes"("entity_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "account_mappings_entity_id_role_key" ON "account_mappings"("entity_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "document_sequences_entity_id_doc_type_key" ON "document_sequences"("entity_id", "doc_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "journal_entries_source_type_source_ref_idx" ON "journal_entries"("source_type", "source_ref");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_entity_id_type_status_idx" ON "invoices"("entity_id", "type", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_vendor_id_idx" ON "invoices"("vendor_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_deleted_at_idx" ON "invoices"("deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bank_transactions_bank_account_id_idx" ON "bank_transactions"("bank_account_id");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_vendor_id_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_transactions_bank_account_id_fkey') THEN
    ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_accounts_entity_id_fkey') THEN
    ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_accounts_gl_account_id_fkey') THEN
    ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_entity_id_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_invoice_id_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_bank_account_id_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_linked_je_id_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_linked_je_id_fkey" FOREIGN KEY ("linked_je_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_entity_id_fkey') THEN
    ALTER TABLE "quotes" ADD CONSTRAINT "quotes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_vendor_id_fkey') THEN
    ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_lines_quote_id_fkey') THEN
    ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_lines_tax_code_id_fkey') THEN
    ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_entity_id_fkey') THEN
    ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_vendor_id_fkey') THEN
    ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'po_lines_po_id_fkey') THEN
    ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'po_lines_tax_code_id_fkey') THEN
    ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_notes_entity_id_fkey') THEN
    ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_notes_vendor_id_fkey') THEN
    ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_notes_linked_invoice_id_fkey') THEN
    ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_linked_invoice_id_fkey" FOREIGN KEY ("linked_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_note_lines_credit_note_id_fkey') THEN
    ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_note_lines_tax_code_id_fkey') THEN
    ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_codes_entity_id_fkey') THEN
    ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_codes_gl_account_id_fkey') THEN
    ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_mappings_entity_id_fkey') THEN
    ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_mappings_chart_of_account_id_fkey') THEN
    ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_chart_of_account_id_fkey" FOREIGN KEY ("chart_of_account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_sequences_entity_id_fkey') THEN
    ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

