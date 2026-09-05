"use client";

import { BookOpen, FileText, Plus, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountFormDialog } from "@/components/accounting/account-form-dialog";
import { AccountingSearch } from "@/components/accounting/accounting-search";
import {
  FIXED_ASSETS_ENABLED,
  POSTING_SETUP_TAB,
  TABS,
} from "@/components/accounting/accounting-utils";
import { AccountsTab } from "@/components/accounting/accounts-tab";
import { AgingSummaryPanel } from "@/components/accounting/aging-summary-panel";
import { AuditLogPanel } from "@/components/accounting/audit-log-panel";
import { BankTab } from "@/components/accounting/bank-tab";
import { BillsTab } from "@/components/accounting/bills-tab";
import { ChartOfAccountsImportDialog } from "@/components/accounting/chart-of-accounts-import-dialog";
import { CorporateFinanceOverview } from "@/components/accounting/corporate-finance-overview";
import { CreditNoteDialog } from "@/components/accounting/credit-note-dialog";
import { CreditNotesTab } from "@/components/accounting/credit-notes-tab";
import { CustomerAdvancesPanel } from "@/components/accounting/customer-advances-panel";
import { FixedAssetsTab } from "@/components/accounting/fixed-assets-tab";
import { InvoiceDialog } from "@/components/accounting/invoice-dialog";
import { InvoicesTab } from "@/components/accounting/invoices-tab";
import { JournalEntriesImportDialog } from "@/components/accounting/journal-entries-import-dialog";
import { JournalEntryDialog } from "@/components/accounting/journal-entry-dialog";
import { JournalsTab } from "@/components/accounting/journals-tab";
import { PaymentsTab } from "@/components/accounting/payments-tab";
import { PurchaseOrderDialog } from "@/components/accounting/purchase-order-dialog";
import { PurchaseOrdersTab } from "@/components/accounting/purchase-orders-tab";
import { QuoteDialog } from "@/components/accounting/quote-dialog";
import { QuotesTab } from "@/components/accounting/quotes-tab";
import { ReceiptsTab } from "@/components/accounting/receipts-tab";
import { ReportsTab } from "@/components/accounting/reports-tab";
import { SettlementDialog } from "@/components/accounting/settlement-dialog";
import { SetupTab } from "@/components/accounting/setup-tab";
import { StatementPanel } from "@/components/accounting/statement-panel";
import { TaxFilingsPanel } from "@/components/accounting/tax-filings-panel";
import { VendorsTab } from "@/components/accounting/vendors-tab";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { Button } from "@/components/ui/button";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import type { ChartOfAccount } from "@/services/accounting.service";
import { type Entity, listEntities } from "@/services/entity.service";

export default function AccountingPage() {
  const { hasPermission } = useAuth();
  const canRead = hasPermission("accounting:read");
  const canCreate = hasPermission("accounting:create");
  const canApprove = hasPermission("accounting:approve");
  const canPost = hasPermission("accounting:post");
  const canAdmin = hasPermission("accounting:admin");

  const [activeTab, setActiveTab] = useTabParam("overview");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);

  const [journalDialogOpen, setJournalDialogOpen] = useState(false);
  const [journalImportOpen, setJournalImportOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(
    null,
  );
  const [accountImportOpen, setAccountImportOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [creditNoteDialogOpen, setCreditNoteDialogOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    listEntities()
      .then((res) => setEntities(res.data))
      .catch((err) => {
        const msg =
          err instanceof ApiError ? err.message : "Failed to load entities";
        toast.error(msg);
      });
  }, []);

  const handleAccountsLoaded = useCallback((data: ChartOfAccount[]) => {
    setAccounts(data);
  }, []);

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Posting Setup is an admin-only config tab.
  const visibleTabs = useMemo(
    () => (canAdmin ? [...TABS, POSTING_SETUP_TAB] : TABS),
    [canAdmin],
  );

  const actionButton = useMemo(() => {
    if (!canCreate) return null;
    switch (activeTab) {
      case "journals":
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setJournalImportOpen(true)}
            >
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button onClick={() => setJournalDialogOpen(true)}>
              <BookOpen className="size-3.5" />
              New Entry
            </Button>
          </div>
        );
      case "coa":
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setAccountImportOpen(true)}
            >
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button
              onClick={() => {
                setEditingAccount(null);
                setAccountDialogOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              Add Account
            </Button>
          </div>
        );
      case "invoices":
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setSettlementDialogOpen(true)}
            >
              <FileText className="size-3.5" />
              Settle multiple
            </Button>
            <Button onClick={() => setInvoiceDialogOpen(true)}>
              <FileText className="size-3.5" />
              Create Invoice
            </Button>
          </div>
        );
      case "receipts":
      case "expense":
      case "payments":
        return (
          <Button
            variant="outline"
            onClick={() => setSettlementDialogOpen(true)}
          >
            <FileText className="size-3.5" />
            Settle multiple
          </Button>
        );
      case "credit-notes":
        return (
          <Button onClick={() => setCreditNoteDialogOpen(true)}>
            <FileText className="size-3.5" />
            New Credit Note
          </Button>
        );
      case "quotes":
        return (
          <Button onClick={() => setQuoteDialogOpen(true)}>
            <FileText className="size-3.5" />
            Create Quote
          </Button>
        );
      case "purchase-orders":
        return (
          <Button onClick={() => setPoDialogOpen(true)}>
            <FileText className="size-3.5" />
            Create PO
          </Button>
        );
      default:
        return null;
    }
  }, [canCreate, activeTab]);

  return (
    <div>
      <PageHeader
        title="Accounting"
        subtitle="Corporate finance, controls and reconciliation"
      >
        {actionButton}
      </PageHeader>

      {canRead ? (
        <div className="mb-4">
          <AccountingSearch onNavigate={setActiveTab} />
        </div>
      ) : null}

      <Tabs tabs={visibleTabs} active={activeTab} onChange={setActiveTab}>
        <TabsContent value="overview">
          <CorporateFinanceOverview
            key={`overview-${refreshKey}`}
            entities={entities}
            canApprove={canApprove}
            canPost={canPost}
            onNavigate={setActiveTab}
            onDataChanged={handleSaved}
          />
          <div className="mt-5">
            <AgingSummaryPanel
              key={`aging-${refreshKey}`}
              entities={entities}
            />
          </div>
        </TabsContent>

        <TabsContent value="journals">
          <JournalsTab
            key={`journals-${refreshKey}`}
            entities={entities}
            canApprove={canApprove}
            canPost={canPost}
            canAdmin={canAdmin}
            onDataChanged={handleSaved}
          />
        </TabsContent>

        <TabsContent value="coa">
          <AccountsTab
            key={`coa-${refreshKey}`}
            entities={entities}
            onAccountsLoaded={handleAccountsLoaded}
            onEditAccount={
              canCreate
                ? (row) => {
                    setEditingAccount(row);
                    setAccountDialogOpen(true);
                  }
                : undefined
            }
          />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesTab key={`invoices-${refreshKey}`} entities={entities} />
          <div className="mt-5">
            <CustomerAdvancesPanel
              key={`advances-${refreshKey}`}
              entities={entities}
            />
          </div>
        </TabsContent>

        <TabsContent value="receipts">
          <ReceiptsTab key={`receipts-${refreshKey}`} entities={entities} />
          <div className="mt-5">
            <CustomerAdvancesPanel
              key={`receipt-advances-${refreshKey}`}
              entities={entities}
            />
          </div>
        </TabsContent>

        <TabsContent value="expense">
          <BillsTab key={`expense-${refreshKey}`} entities={entities} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab key={`payments-${refreshKey}`} entities={entities} />
        </TabsContent>

        {FIXED_ASSETS_ENABLED ? (
          <TabsContent value="fixed-assets">
            <FixedAssetsTab
              key={`fixed-assets-${refreshKey}`}
              entities={entities}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="credit-notes">
          <CreditNotesTab
            key={`credit-notes-${refreshKey}`}
            entities={entities}
            canPost={canPost}
            canAdmin={canAdmin}
          />
        </TabsContent>

        <TabsContent value="quotes">
          <QuotesTab
            key={`quotes-${refreshKey}`}
            entities={entities}
            canCreate={canCreate}
            canAdmin={canAdmin}
          />
        </TabsContent>

        <TabsContent value="purchase-orders">
          <PurchaseOrdersTab
            key={`purchase-orders-${refreshKey}`}
            entities={entities}
            canCreate={canCreate}
            canAdmin={canAdmin}
          />
        </TabsContent>

        <TabsContent value="bank">
          <BankTab
            key={`bank-${refreshKey}`}
            entities={entities}
            canReconcile={canAdmin}
          />
        </TabsContent>

        <TabsContent value="vendors">
          <VendorsTab key={`vendors-${refreshKey}`} />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab key={`reports-${refreshKey}`} entities={entities} />
          <div className="mt-5">
            <StatementPanel
              key={`statement-${refreshKey}`}
              entities={entities}
            />
          </div>
          <div className="mt-5">
            <TaxFilingsPanel
              key={`tax-filings-${refreshKey}`}
              entities={entities}
              canAdmin={canAdmin}
            />
          </div>
        </TabsContent>

        {canAdmin ? (
          <TabsContent value="posting-setup">
            <SetupTab entities={entities} canAdmin={canAdmin} />
            <div className="mt-5">
              <AuditLogPanel key={`audit-${refreshKey}`} />
            </div>
          </TabsContent>
        ) : null}
      </Tabs>

      <JournalEntryDialog
        open={journalDialogOpen}
        onOpenChange={setJournalDialogOpen}
        entities={entities}
        accounts={accounts}
        onSaved={handleSaved}
      />

      <AccountFormDialog
        key={editingAccount?.id ?? "create"}
        open={accountDialogOpen}
        onOpenChange={(open) => {
          setAccountDialogOpen(open);
          if (!open) setEditingAccount(null);
        }}
        entities={entities}
        accounts={accounts}
        account={editingAccount}
        onSaved={handleSaved}
      />

      <ChartOfAccountsImportDialog
        open={accountImportOpen}
        onOpenChange={setAccountImportOpen}
        entities={entities}
        onImported={handleSaved}
      />

      <JournalEntriesImportDialog
        open={journalImportOpen}
        onOpenChange={setJournalImportOpen}
        entities={entities}
        onImported={handleSaved}
      />

      <InvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        entities={entities}
        onSaved={handleSaved}
      />

      <CreditNoteDialog
        open={creditNoteDialogOpen}
        onOpenChange={setCreditNoteDialogOpen}
        entities={entities}
        onSaved={handleSaved}
      />

      <QuoteDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        entities={entities}
        onSaved={handleSaved}
      />

      <PurchaseOrderDialog
        open={poDialogOpen}
        onOpenChange={setPoDialogOpen}
        entities={entities}
        onSaved={handleSaved}
      />

      <SettlementDialog
        open={settlementDialogOpen}
        onOpenChange={setSettlementDialogOpen}
        entities={entities}
        onDone={handleSaved}
      />
    </div>
  );
}
