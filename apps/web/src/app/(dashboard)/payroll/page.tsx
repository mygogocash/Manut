"use client";

import { FileText, GitFork, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConsultantInvoiceDialog } from "@/components/payroll/consultant-invoice-dialog";
import { PayrollBulkImportDialog } from "@/components/payroll/payroll-bulk-import-dialog";
import { PayrollInvoicesTab } from "@/components/payroll/payroll-invoices-tab";
import { PayrollRunDetailSheet } from "@/components/payroll/payroll-run-detail-sheet";
import { PayrollRunsTab } from "@/components/payroll/payroll-runs-tab";
import { ALL_FILTER, PAYROLL_TABS } from "@/components/payroll/payroll-utils";
import { DataPagination } from "@/components/shared/data-pagination";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { Button } from "@/components/ui/button";
import { usePagination } from "@/hooks/use-pagination";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type Entity } from "@/services/entity.service";
import {
  approvePayrollRun,
  type ConsultantInvoice,
  deletePayrollRun,
  listConsultantInvoices,
  listPayrollRuns,
  type PayrollRun,
} from "@/services/payroll.service";
import {
  getUserFormLookups,
  listUsers,
  type UserListItem,
} from "@/services/user.service";

export default function PayrollPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("payroll:create");
  const canApprove = hasPermission("payroll:approve");
  const canDelete = hasPermission("payroll:hr-admin");
  const canManageChain = hasPermission("payroll:hr-admin");

  const [activeTab, setActiveTab] = useTabParam("runs");

  const [entities, setEntities] = useState<Entity[]>([]);
  const [consultants, setConsultants] = useState<UserListItem[]>([]);

  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runEntityFilter, setRunEntityFilter] = useState(ALL_FILTER);
  const [runStatusFilter, setRunStatusFilter] = useState(ALL_FILTER);
  const [runPeriodFilter, setRunPeriodFilter] = useState("");
  const runPagination = usePagination();

  const [invoices, setInvoices] = useState<ConsultantInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [invEntityFilter, setInvEntityFilter] = useState(ALL_FILTER);
  const [invStatusFilter, setInvStatusFilter] = useState(ALL_FILTER);
  const [invPeriodFilter, setInvPeriodFilter] = useState("");
  const invPagination = usePagination();

  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getUserFormLookups(), listUsers({ limit: 100 })])
      .then(([lookupsRes, userRes]) => {
        setEntities(lookupsRes.data.entities);
        setConsultants(
          userRes.data.filter((u) => u.employmentType === "consultant"),
        );
      })
      .catch((err) => {
        const msg =
          err instanceof ApiError ? err.message : "Failed to load lookups";
        toast.error(msg);
      });
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      setLoadingRuns(true);
      const result = await listPayrollRuns({
        page: runPagination.page,
        limit: runPagination.pageSize,
        entityId: runEntityFilter === ALL_FILTER ? undefined : runEntityFilter,
        status: runStatusFilter === ALL_FILTER ? undefined : runStatusFilter,
        period: runPeriodFilter || undefined,
      });
      setRuns(result.data);
      runPagination.setTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load payroll runs";
      toast.error(msg);
    } finally {
      setLoadingRuns(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    runPagination.page,
    runPagination.pageSize,
    runEntityFilter,
    runStatusFilter,
    runPeriodFilter,
    runPagination.setTotalCount,
  ]);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoadingInvoices(true);
      const result = await listConsultantInvoices({
        page: invPagination.page,
        limit: invPagination.pageSize,
        entityId: invEntityFilter === ALL_FILTER ? undefined : invEntityFilter,
        status: invStatusFilter === ALL_FILTER ? undefined : invStatusFilter,
        period: invPeriodFilter || undefined,
      });
      setInvoices(result.data);
      invPagination.setTotalCount(result.meta.total);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load consultant invoices";
      toast.error(msg);
    } finally {
      setLoadingInvoices(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    invPagination.page,
    invPagination.pageSize,
    invEntityFilter,
    invStatusFilter,
    invPeriodFilter,
    invPagination.setTotalCount,
  ]);

  useEffect(() => {
    if (activeTab === "runs") void fetchRuns();
  }, [activeTab, fetchRuns]);

  useEffect(() => {
    if (activeTab === "consultants") void fetchInvoices();
  }, [activeTab, fetchInvoices]);

  useEffect(() => {
    runPagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    runEntityFilter,
    runStatusFilter,
    runPeriodFilter,
    runPagination.setPage,
  ]);

  useEffect(() => {
    invPagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    invEntityFilter,
    invStatusFilter,
    invPeriodFilter,
    invPagination.setPage,
  ]);

  const handleApproveRun = useCallback(
    async (run: PayrollRun) => {
      try {
        await approvePayrollRun(run.id);
        toast.success("Payroll run approved");
        void fetchRuns();
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Failed to approve payroll run";
        toast.error(msg);
      }
    },
    [fetchRuns],
  );

  const handleDeleteRun = useCallback(
    async (run: PayrollRun) => {
      try {
        await deletePayrollRun(run.id);
        toast.success("Payroll run deleted");
        void fetchRuns();
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Failed to delete payroll run";
        toast.error(msg);
      }
    },
    [fetchRuns],
  );

  const handleSaved = useCallback(() => {
    void fetchRuns();
    void fetchInvoices();
  }, [fetchRuns, fetchInvoices]);

  const runFiltersDirty = useMemo(
    () =>
      runEntityFilter !== ALL_FILTER ||
      runStatusFilter !== ALL_FILTER ||
      !!runPeriodFilter,
    [runEntityFilter, runStatusFilter, runPeriodFilter],
  );

  const invFiltersDirty = useMemo(
    () =>
      invEntityFilter !== ALL_FILTER ||
      invStatusFilter !== ALL_FILTER ||
      !!invPeriodFilter,
    [invEntityFilter, invStatusFilter, invPeriodFilter],
  );

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="HR runs payroll for entities here. Staff-specific self-service lives under My Portal where applicable."
      >
        {canManageChain && activeTab === "runs" && (
          <Button asChild variant="outline">
            <Link href="/payroll/approval">
              <GitFork className="size-3.5" />
              Approval chain
            </Link>
          </Button>
        )}
        {canCreate && activeTab === "runs" && (
          <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
            <Upload className="size-3.5" />
            Import payroll
          </Button>
        )}
        {canCreate && activeTab === "consultants" && (
          <Button onClick={() => setInvoiceDialogOpen(true)}>
            <FileText className="size-3.5" />
            Add Invoice
          </Button>
        )}
      </PageHeader>

      <Tabs tabs={PAYROLL_TABS} active={activeTab} onChange={setActiveTab}>
        <TabsContent value="runs">
          <PayrollRunsTab
            runs={runs}
            loading={loadingRuns}
            entities={entities}
            canApprove={canApprove}
            entityFilter={runEntityFilter}
            statusFilter={runStatusFilter}
            periodFilter={runPeriodFilter}
            filtersDirty={runFiltersDirty}
            onEntityFilterChange={setRunEntityFilter}
            onStatusFilterChange={setRunStatusFilter}
            onPeriodFilterChange={setRunPeriodFilter}
            onClearFilters={() => {
              setRunEntityFilter(ALL_FILTER);
              setRunStatusFilter(ALL_FILTER);
              setRunPeriodFilter("");
            }}
            onApproveRun={handleApproveRun}
            onDeleteRun={canDelete ? handleDeleteRun : undefined}
            onRowClick={(r) => setDetailRunId(r.id)}
            pagination={
              <DataPagination
                page={runPagination.page}
                pageSize={runPagination.pageSize}
                totalCount={runPagination.totalCount}
                totalPages={runPagination.totalPages}
                onPageChange={runPagination.setPage}
                onPageSizeChange={runPagination.setPageSize}
              />
            }
          />
        </TabsContent>

        <TabsContent value="consultants">
          <PayrollInvoicesTab
            invoices={invoices}
            loading={loadingInvoices}
            entities={entities}
            entityFilter={invEntityFilter}
            statusFilter={invStatusFilter}
            periodFilter={invPeriodFilter}
            filtersDirty={invFiltersDirty}
            onEntityFilterChange={setInvEntityFilter}
            onStatusFilterChange={setInvStatusFilter}
            onPeriodFilterChange={setInvPeriodFilter}
            onClearFilters={() => {
              setInvEntityFilter(ALL_FILTER);
              setInvStatusFilter(ALL_FILTER);
              setInvPeriodFilter("");
            }}
            pagination={
              <DataPagination
                page={invPagination.page}
                pageSize={invPagination.pageSize}
                totalCount={invPagination.totalCount}
                totalPages={invPagination.totalPages}
                onPageChange={invPagination.setPage}
                onPageSizeChange={invPagination.setPageSize}
              />
            }
          />
        </TabsContent>
      </Tabs>

      <PayrollRunDetailSheet
        runId={detailRunId}
        open={detailRunId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailRunId(null);
        }}
        canEdit={canCreate}
        canRecalculate={canCreate}
        onPayslipUpdated={() => void fetchRuns()}
      />

      <PayrollBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImported={handleSaved}
      />

      <ConsultantInvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        entities={entities}
        consultants={consultants}
        onSaved={handleSaved}
      />
    </div>
  );
}
