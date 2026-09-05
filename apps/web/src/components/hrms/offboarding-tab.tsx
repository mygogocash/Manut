"use client";

import {
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  ALL_FILTER,
  OFFBOARDING_STATUSES,
} from "@/components/hrms/hrms-constants";
import { OffboardingChecklist } from "@/components/hrms/offboarding-checklist";
import { OffboardingTemplateDialog } from "@/components/hrms/offboarding-template-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  OffboardingRun,
  OffboardingTaskInput,
} from "@/services/hrms.service";

export function OffboardingTab({
  runs,
  loading,
  statusFilter,
  onStatusFilterChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  canManage,
  currentUserName,
  onCreateOffboarding,
  expandedRunId,
  onExpandRun,
  updatingTasks,
  onToggleTask,
  onSaveTasks,
  onSign,
  showDeleted,
  onShowDeletedChange,
  onDeleteRun,
  onRestoreRun,
}: {
  runs: OffboardingRun[];
  loading: boolean;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  canManage: boolean;
  currentUserName: string;
  onCreateOffboarding: () => void;
  expandedRunId: string | null;
  onExpandRun: (id: string | null) => void;
  updatingTasks: Set<string>;
  onToggleTask: (runId: string, taskKey: string, done: boolean) => void;
  onSaveTasks?: (runId: string, tasks: OffboardingTaskInput[]) => Promise<void>;
  onSign?: (
    runId: string,
    party: "employee" | "hr",
    name: string,
  ) => Promise<void>;
  showDeleted: boolean;
  onShowDeletedChange: (v: boolean) => void;
  onDeleteRun: (run: OffboardingRun) => void;
  onRestoreRun: (run: OffboardingRun) => void;
}) {
  const columns = useMemo(
    () => [
      {
        key: "expand",
        mobileRole: "hidden" as const,
        header: "",
        className: "w-[36px]",
        render: (r: OffboardingRun) => (
          <span className="text-muted-foreground">
            {expandedRunId === r.id ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </span>
        ),
      },
      {
        key: "employeeName",
        mobileRole: "title" as const,
        header: "Employee",
        render: (r: OffboardingRun) => (
          <span className="text-foreground text-xs font-medium">
            {r.employee?.name ?? r.employeeName}
          </span>
        ),
      },
      {
        key: "department",
        mobileRole: "subtitle" as const,
        header: "Department",
      },
      {
        key: "lastWorkingDay",
        mobileRole: "field" as const,
        header: "Last Working Day",
        render: (r: OffboardingRun) => (
          <span className="tabular-nums">
            {new Date(r.lastWorkingDay).toLocaleDateString()}
          </span>
        ),
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        render: (r: OffboardingRun) => (
          <Badge status={r.status}>{r.status.replace("_", " ")}</Badge>
        ),
      },
      {
        key: "progress",
        mobileRole: "field" as const,
        header: "Progress",
        render: (r: OffboardingRun) => {
          const t = r.tasks ?? [];
          const done = t.filter((x) => x.done).length;
          return (
            <span className="tabular-nums">
              {done}/{t.length} completed
            </span>
          );
        },
      },
      // HR-only per-row action: delete a duplicate (active view) or restore it
      // (deleted view). stopPropagation so it doesn't also expand the row.
      ...(canManage
        ? [
            {
              key: "actions",
              mobileRole: "actions" as const,
              header: "",
              className: "w-[56px]",
              render: (r: OffboardingRun) =>
                showDeleted ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Restore"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestoreRun(r);
                    }}
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Delete (duplicate)"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRun(r);
                    }}
                  >
                    <Trash2 className="text-destructive size-3.5" />
                  </Button>
                ),
            },
          ]
        : []),
    ],
    [expandedRunId, canManage, showDeleted, onDeleteRun, onRestoreRun],
  );

  const [templateOpen, setTemplateOpen] = useState(false);

  return (
    <>
      <div
        className={`
          border-border bg-surface flex flex-wrap items-center gap-2 rounded-lg
          border p-3 shadow-sm
        `}
      >
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger
            className="h-10 w-[160px] text-xs"
            aria-label="Filter offboarding by status"
          >
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {OFFBOARDING_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canManage ? (
          <Button
            variant={showDeleted ? "secondary" : "outline"}
            onClick={() => onShowDeletedChange(!showDeleted)}
            title="Recently deleted runs (restorable)"
          >
            <Trash2 className="size-3.5" />
            {showDeleted ? "Viewing deleted" : "Deleted"}
          </Button>
        ) : null}

        <div className="flex-1" />

        {canManage && !showDeleted ? (
          <Button variant="outline" onClick={() => setTemplateOpen(true)}>
            <Settings2 className="size-3.5" />
            Manage template
          </Button>
        ) : null}

        {!showDeleted ? (
          <Button
            onClick={onCreateOffboarding}
            disabled={!canManage}
            title={
              !canManage ? "Requires Offboarding manage permission" : undefined
            }
          >
            <Plus className="size-3.5" />
            New offboarding
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={runs}
        loading={loading}
        onRowClick={(r) => onExpandRun(expandedRunId === r.id ? null : r.id)}
        emptyMessage="No offboarding runs found"
        pagination={
          <DataPagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        }
      />

      {expandedRunId && (
        <OffboardingChecklist
          run={runs.find((r) => r.id === expandedRunId) ?? null}
          updatingTasks={updatingTasks}
          canManage={canManage}
          currentUserName={currentUserName}
          onToggle={onToggleTask}
          onSaveTasks={onSaveTasks}
          onSign={onSign}
        />
      )}

      <OffboardingTemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
      />
    </>
  );
}
