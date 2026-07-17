"use client";

import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { HolidayDialog } from "@/components/holidays/holiday-dialog";
import { PageHeader } from "@/components/shared/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type Entity, listEntities } from "@/services/entity.service";
import {
  deleteHoliday,
  listHolidays,
  type PublicHoliday,
} from "@/services/holiday.service";

const ALL = "__all__";

function currentYear(): number {
  return new Date().getFullYear();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type SortKey = "date" | "name" | "entity" | "status";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  column,
  activeKey,
  activeDir,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  activeKey: SortKey;
  activeDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === column;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}`}
        className={`
          hover:text-foreground
          -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5
        `}
      >
        {label}
        {active ? (
          activeDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

export default function PublicHolidaysPage() {
  const { hasPermission } = useAuth();
  const canRead = hasPermission("leave:read") || hasPermission("leave:hr-read");
  const canManage = hasPermission("leave:hr-settings");

  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityFilter, setEntityFilter] = useState<string>(ALL);
  const [yearFilter, setYearFilter] = useState<number>(currentYear());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PublicHoliday | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PublicHoliday | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listHolidays({
        entityId: entityFilter === ALL ? undefined : entityFilter,
        year: yearFilter,
        limit: 500,
      });
      setHolidays(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load holidays";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, yearFilter]);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  useEffect(() => {
    if (!canManage) return;
    void listEntities()
      .then((res) => setEntities(res.data))
      .catch(() => {});
  }, [canManage]);

  const yearOptions = useMemo(() => {
    const cy = currentYear();
    return [cy - 1, cy, cy + 1, cy + 2];
  }, []);

  const sortedHolidays = useMemo(() => {
    const byDate = (a: PublicHoliday, b: PublicHoliday) =>
      new Date(a.date).getTime() - new Date(b.date).getTime();
    const dir = sortDir === "asc" ? 1 : -1;
    return [...holidays].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = byDate(a, b);
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "entity":
          cmp =
            a.entity.name.localeCompare(b.entity.name) ||
            a.entity.code.localeCompare(b.entity.code);
          break;
        case "status":
          cmp = Number(b.isActive) - Number(a.isActive);
          break;
      }
      // Chronological tiebreak, kept stable regardless of sort direction.
      return cmp !== 0 ? cmp * dir : byDate(a, b);
    });
  }, [holidays, sortKey, sortDir]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      await deleteHoliday(pendingDelete.id);
      toast.success(`Removed "${pendingDelete.name}"`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete holiday";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  if (!canRead) {
    return (
      <div className="px-6 py-10">
        <PageHeader
          title="Public Holidays"
          subtitle="You do not have permission to view holidays."
        />
      </div>
    );
  }

  const defaultEntityForNew =
    entityFilter !== ALL ? entityFilter : (entities[0]?.id ?? undefined);

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Public Holidays"
        subtitle="Office holiday calendar per entity. Excluded from leave-day counts."
      >
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New holiday
          </Button>
        )}
      </PageHeader>

      <div
        className={`
          border-border bg-surface mb-3 flex flex-wrap items-center gap-3
          rounded-lg border p-3
        `}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Entity</span>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="h-9 w-[220px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All entities</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} ({e.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Year</span>
          <Select
            value={String(yearFilter)}
            onValueChange={(v) => setYearFilter(Number(v))}
          >
            <SelectTrigger className="h-9 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader
                label="Date"
                column="date"
                activeKey={sortKey}
                activeDir={sortDir}
                onSort={toggleSort}
              />
              <SortHeader
                label="Holiday"
                column="name"
                activeKey={sortKey}
                activeDir={sortDir}
                onSort={toggleSort}
              />
              <SortHeader
                label="Entity"
                column="entity"
                activeKey={sortKey}
                activeDir={sortDir}
                onSort={toggleSort}
              />
              <SortHeader
                label="Status"
                column="status"
                activeKey={sortKey}
                activeDir={sortDir}
                onSort={toggleSort}
              />
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <Loader2
                    className={`
                      text-muted-foreground mx-auto h-5 w-5 animate-spin
                    `}
                  />
                </TableCell>
              </TableRow>
            ) : holidays.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-12 text-center text-sm"
                >
                  No holidays for this filter.
                </TableCell>
              </TableRow>
            ) : (
              sortedHolidays.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="whitespace-nowrap">
                    <span className="font-medium">{formatDate(h.date)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{h.name}</div>
                    {h.notes && (
                      <div
                        className={`
                          text-muted-foreground mt-0.5 line-clamp-2 max-w-md
                          text-xs
                        `}
                      >
                        {h.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">
                      {h.entity.name}{" "}
                      <span className="text-muted-foreground">
                        ({h.entity.code})
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    {h.isActive ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="inline-flex gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit"
                          onClick={() => {
                            setEditing(h);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete"
                          onClick={() => setPendingDelete(h)}
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <HolidayDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        entities={entities}
        defaultEntityId={defaultEntityForNew}
        holiday={editing}
        onSaved={load}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this holiday?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `Removes "${pendingDelete.name}" on ${formatDate(pendingDelete.date)}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
