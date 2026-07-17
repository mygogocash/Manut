"use client";

import { BookOpen, FileText, Plus, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountFormDialog } from "@/components/accounting/account-form-dialog";
import { TABS } from "@/components/accounting/accounting-utils";
import { AccountsTab } from "@/components/accounting/accounts-tab";
import { BankTab } from "@/components/accounting/bank-tab";
import { ChartOfAccountsImportDialog } from "@/components/accounting/chart-of-accounts-import-dialog";
import { InvoiceDialog } from "@/components/accounting/invoice-dialog";
import { InvoicesTab } from "@/components/accounting/invoices-tab";
import { JournalEntriesImportDialog } from "@/components/accounting/journal-entries-import-dialog";
import { JournalEntryDialog } from "@/components/accounting/journal-entry-dialog";
import { JournalsTab } from "@/components/accounting/journals-tab";
import { VendorsTab } from "@/components/accounting/vendors-tab";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import type { ChartOfAccount } from "@/services/accounting.service";
import { type Entity, listEntities } from "@/services/entity.service";

export default function AccountingPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("accounting:create");
  const canApprove = hasPermission("accounting:approve");
  const canPost = hasPermission("accounting:post");
  const canAdmin = hasPermission("accounting:admin");

  const [activeTab, setActiveTab] = useState("journals");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);

  const [journalDialogOpen, setJournalDialogOpen] = useState(false);
  const [journalImportOpen, setJournalImportOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountImportOpen, setAccountImportOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

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
            <Button onClick={() => setAccountDialogOpen(true)}>
              <Plus className="size-3.5" />
              Add Account
            </Button>
          </div>
        );
      case "invoices":
        return (
          <Button onClick={() => setInvoiceDialogOpen(true)}>
            <FileText className="size-3.5" />
            Create Invoice
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
        subtitle="Financial records and reconciliation"
      >
        {actionButton}
      </PageHeader>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab}>
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
          />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesTab key={`invoices-${refreshKey}`} entities={entities} />
        </TabsContent>

        <TabsContent value="bank">
          <BankTab key={`bank-${refreshKey}`} entities={entities} />
        </TabsContent>

        <TabsContent value="vendors">
          <VendorsTab key={`vendors-${refreshKey}`} />
        </TabsContent>
      </Tabs>

      <JournalEntryDialog
        open={journalDialogOpen}
        onOpenChange={setJournalDialogOpen}
        entities={entities}
        accounts={accounts}
        onSaved={handleSaved}
      />

      <AccountFormDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        entities={entities}
        accounts={accounts}
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
    </div>
  );
}
