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

import { ExpandedTaskList } from "@/components/hrms/expanded-task-list";
import {
  ALL_FILTER,
  ONBOARDING_STATUSES,
} from "@/components/hrms/hrms-constants";
import { OnboardingTemplateDialog } from "@/components/hrms/onboarding-template-dialog";
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
  OnboardingRun,
  OnboardingTaskInput,
} from "@/services/hrms.service";

export function OnboardingTab({
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
  onCreateOnboarding,
  expandedRunId,
  onExpandRun,
  updatingTasks,
  onToggleTask,
  onSaveTasks,
  showDeleted,
  onShowDeletedChange,
  onDeleteRun,
  onRestoreRun,
}: {
  runs: OnboardingRun[];
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
  onCreateOnboarding: () => void;
  expandedRunId: string | null;
  onExpandRun: (id: string | null) => void;
  updatingTasks: Set<string>;
  onToggleTask: (runId: string, taskKey: string, done: boolean) => void;
  onSaveTasks?: (runId: string, tasks: OnboardingTaskInput[]) => Promise<void>;
  showDeleted: boolean;
  onShowDeletedChange: (v: boolean) => void;
  onDeleteRun: (run: OnboardingRun) => void;
  onRestoreRun: (run: OnboardingRun) => void;
}) {
  const columns = useMemo(
    () => [
      {
        key: "expand",
        header: "",
        className: "w-[36px]",
        render: (r: OnboardingRun) => (
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
        header: "Employee",
        render: (r: OnboardingRun) => (
          <span className="text-foreground text-xs font-medium">
            {r.employee?.name ?? r.employeeName}
          </span>
        ),
      },
      { key: "department", header: "Department" },
      {
        key: "startDate",
        header: "Start Date",
        render: (r: OnboardingRun) => (
          <span className="tabular-nums">
            {new Date(r.startDate).toLocaleDateString()}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (r: OnboardingRun) => (
          <Badge status={r.status}>{r.status.replace("_", " ")}</Badge>
        ),
      },
      {
        key: "progress",
        header: "Progress",
        render: (r: OnboardingRun) => {
          const tasks = r.tasks ?? [];
          const done = tasks.filter((t) => t.done).length;
          return (
            <span className="tabular-nums">
              {done}/{tasks.length} completed
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
              header: "",
              className: "w-[56px]",
              render: (r: OnboardingRun) =>
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
          border-border bg-surface flex items-center gap-2 rounded-lg border p-3
          shadow-sm
        `}
      >
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="h-10 w-[160px] text-xs">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {ONBOARDING_STATUSES.map((s) => (
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

        {canManage && !showDeleted && (
          <>
            <Button variant="outline" onClick={() => setTemplateOpen(true)}>
              <Settings2 className="size-3.5" />
              Manage template
            </Button>
            <Button onClick={onCreateOnboarding}>
              <Plus className="size-3.5" />
              New onboarding
            </Button>
          </>
        )}
      </div>

      <DataTable
        columns={columns}
        data={runs}
        loading={loading}
        onRowClick={(r) => onExpandRun(expandedRunId === r.id ? null : r.id)}
        emptyMessage="No onboarding runs found"
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
        <ExpandedTaskList
          run={runs.find((r) => r.id === expandedRunId) ?? null}
          updatingTasks={updatingTasks}
          canManage={canManage}
          onToggle={onToggleTask}
          onSaveTasks={onSaveTasks}
        />
      )}

      <OnboardingTemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
      />
    </>
  );
}
