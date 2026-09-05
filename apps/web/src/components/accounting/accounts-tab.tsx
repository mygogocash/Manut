"use client";

import { Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ACCOUNT_TYPES,
  ALL_FILTER,
  formatCurrency,
} from "@/components/accounting/accounting-utils";
import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  type AccountSortField,
  type ChartOfAccount,
  listAccounts,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

interface AccountsTabProps {
  entities: Entity[];
  onAccountsLoaded: (accounts: ChartOfAccount[]) => void;
  onEditAccount?: (account: ChartOfAccount) => void;
}

function csvEscape(value: string | null | undefined): string {
  const text = value ?? "";
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function AccountsTab({
  entities,
  onAccountsLoaded,
  onEditAccount,
}: AccountsTabProps) {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState(ALL_FILTER);
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER);
  const [sortBy, setSortBy] = useState<AccountSortField | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSortChange = useCallback(
    (key: string) => {
      setSortBy((prev) => {
        if (prev !== key) {
          setSortOrder("asc");
          return key as AccountSortField;
        }
        if (sortOrder === "asc") {
          setSortOrder("desc");
          return key as AccountSortField;
        }
        setSortOrder("asc");
        return undefined;
      });
    },
    [sortOrder],
  );

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listAccounts({
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        type: typeFilter === ALL_FILTER ? undefined : typeFilter,
        sortBy,
        sortOrder,
      });
      setAccounts(result.data);
      onAccountsLoaded(result.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load accounts";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, typeFilter, sortBy, sortOrder, onAccountsLoaded]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const columns = useMemo(
    () => [
      {
        key: "code",
        mobileRole: "title" as const,
        header: "Code",
        sortable: true,
        render: (a: ChartOfAccount) => (
          <span className="font-medium tabular-nums">{a.code}</span>
        ),
      },
      {
        key: "name",
        mobileRole: "subtitle" as const,
        header: "Name",
        sortable: true,
        render: (a: ChartOfAccount) => (
          <div className="flex flex-col">
            <span>{a.name}</span>
            {a.nameTh ? (
              <span className="text-muted-foreground text-xs" lang="th">
                {a.nameTh}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: "type",
        mobileRole: "detail" as const,
        header: "Type",
        sortable: true,
        render: (a: ChartOfAccount) => <Badge status={a.type}>{a.type}</Badge>,
      },
      {
        key: "balance",
        mobileRole: "field" as const,
        header: "Balance",
        sortable: true,
        render: (a: ChartOfAccount) => (
          <span className="tabular-nums">{formatCurrency(a.balance)}</span>
        ),
        className: "text-right",
      },
    ],
    [],
  );

  const filtersDirty = useMemo(
    () => entityFilter !== ALL_FILTER || typeFilter !== ALL_FILTER,
    [entityFilter, typeFilter],
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`
          border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
          shadow-sm
          md:flex-row md:items-center
        `}
      >
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-10 min-w-[140px] text-xs">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All entities</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-10 min-w-[120px] text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All types</SelectItem>
            {ACCOUNT_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtersDirty && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setEntityFilter(ALL_FILTER);
              setTypeFilter(ALL_FILTER);
            }}
            className="text-xs"
          >
            Clear
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="xs"
          className="md:ml-auto"
          disabled={accounts.length === 0}
          onClick={() => {
            const header = [
              "code",
              "type",
              "thai_name",
              "english_name",
              "thai_description",
              "english_description",
              "active",
            ];
            const lines = [
              header.join(","),
              ...accounts.map((a) =>
                [
                  csvEscape(a.code),
                  csvEscape(a.type),
                  csvEscape(a.nameTh),
                  csvEscape(a.name),
                  csvEscape(a.descriptionTh),
                  csvEscape(a.description),
                  a.isActive ? "true" : "false",
                ].join(","),
              ),
            ];
            const blob = new Blob([`${lines.join("\n")}\n`], {
              type: "text/csv;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "chart-of-accounts.csv";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={accounts}
        loading={loading}
        emptyMessage="No accounts found"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        onRowClick={onEditAccount}
      />
    </div>
  );
}
