"use client";

import {
  AlertTriangle,
  Bell,
  FilePlus,
  FileSignature,
  ListChecks,
  Megaphone,
  MoreHorizontal,
  Search,
  Send,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { LegalFormDialog } from "@/components/legal/legal-form-dialog";
import { LegalNotificationSettingsDialog } from "@/components/legal/legal-notification-settings-dialog";
import { LegalPreviewDialog } from "@/components/legal/legal-preview-dialog";
import { LegalShareDialog } from "@/components/legal/legal-share-dialog";
import { SendForSignatureDialog } from "@/components/legal/send-for-signature-dialog";
import { SignaturesDialog } from "@/components/legal/signatures-dialog";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type Entity, listEntities } from "@/services/entity.service";
import {
  deleteLegalDocument,
  getLegalDocument,
  getLegalFolders,
  getLegalStats,
  LEGAL_KIND_LABELS,
  LEGAL_KINDS,
  LEGAL_STATUS_LABELS,
  LEGAL_STATUSES,
  type LegalDocument,
  type LegalDocumentListItem,
  type LegalFolder,
  type LegalStats,
  listLegalDocuments,
  updateLegalDocument,
} from "@/services/legal.service";

const ALL_FILTER = "__all__";

function startOfTodayUTC(): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00Z`);
  return Math.floor(
    (target.getTime() - startOfTodayUTC().getTime()) / 86_400_000,
  );
}

function expiryCellTone(daysRemaining: number | null, leadDays: number) {
  if (daysRemaining === null) return "text-muted-foreground";
  if (daysRemaining < 0) return "text-destructive";
  if (daysRemaining <= leadDays) return "text-warning";
  return "text-foreground";
}

const STATUS_VARIANT: Record<
  string,
  "green" | "red" | "grey" | "blue" | "gold"
> = {
  active: "green",
  expired: "red",
  archived: "grey",
  draft: "blue",
};

export default function LegalPage() {
  const { hasPermission } = useAuth();
  const canRead = hasPermission("legal:read");
  const canUpdate = hasPermission("legal:update");
  const canDelete = hasPermission("legal:delete");
  const canSignSend = hasPermission("legal:sign-send");
  const canSignView = hasPermission("legal:sign-view") || canSignSend;
  const canShare = hasPermission("legal:share");

  const [docs, setDocs] = useState<LegalDocumentListItem[]>([]);
  const [stats, setStats] = useState<LegalStats | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [kindFilter, setKindFilter] = useState<string>(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER);
  const [entityFilter, setEntityFilter] = useState<string>(ALL_FILTER);

  const pagination = usePagination();
  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    setTotalCount,
    totalPages,
    totalCount,
  } = pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [signaturesOpen, setSignaturesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<LegalDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<LegalDocumentListItem | null>(
    null,
  );
  const [signingDoc, setSigningDoc] = useState<LegalDocumentListItem | null>(
    null,
  );
  const [editingDoc, setEditingDoc] = useState<
    LegalDocument | LegalDocumentListItem | null
  >(null);
  const [folderFilter, setFolderFilter] = useState<string>(ALL_FILTER);
  const [folders, setFolders] = useState<LegalFolder[]>([]);

  const fetchDocs = useCallback(async () => {
    if (!canRead) return;
    try {
      setLoading(true);
      const res = await listLegalDocuments({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        kind: kindFilter === ALL_FILTER ? undefined : kindFilter,
        status: statusFilter === ALL_FILTER ? undefined : statusFilter,
        entityId: entityFilter === ALL_FILTER ? undefined : entityFilter,
        folder: folderFilter === ALL_FILTER ? undefined : folderFilter,
      });
      setDocs(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load documents";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    canRead,
    page,
    pageSize,
    debouncedSearch,
    kindFilter,
    statusFilter,
    entityFilter,
    folderFilter,
    setTotalCount,
  ]);

  const fetchFolders = useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await getLegalFolders();
      setFolders(res.data);
    } catch {
      // non-critical
    }
  }, [canRead]);

  const fetchStats = useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await getLegalStats();
      setStats(res.data);
    } catch {
      // ignore — non-critical
    }
  }, [canRead]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    void fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    listEntities()
      .then((res) => setEntities(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    kindFilter,
    statusFilter,
    entityFilter,
    folderFilter,
    setPage,
  ]);

  const handleSaved = useCallback(
    (doc: LegalDocument) => {
      setDocs((prev) => {
        const existing = prev.findIndex((d) => d.id === doc.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = doc;
          return next;
        }
        return [doc, ...prev];
      });
      void fetchStats();
      void fetchFolders();
    },
    [fetchStats, fetchFolders],
  );

  const handleEdit = useCallback((doc: LegalDocumentListItem) => {
    setEditingDoc(doc);
    setFormOpen(true);
  }, []);

  const handleSendForSignature = useCallback((doc: LegalDocumentListItem) => {
    setSigningDoc(doc);
    setSendOpen(true);
  }, []);

  const handleViewSignatures = useCallback((doc: LegalDocumentListItem) => {
    setSigningDoc(doc);
    setSignaturesOpen(true);
  }, []);

  const handleShare = useCallback(async (doc: LegalDocumentListItem) => {
    // List item omits `notes` and may have an empty `shares` array.
    // Pull the full detail so the dialog renders the current share list.
    try {
      const res = await getLegalDocument(doc.id);
      setShareDoc(res.data);
      setShareOpen(true);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to open share dialog";
      toast.error(message);
    }
  }, []);

  const handleShareChanged = useCallback((next: LegalDocument | null) => {
    if (!next) return;
    setShareDoc(next);
    setDocs((prev) =>
      prev.map((d) => (d.id === next.id ? { ...d, ...next } : d)),
    );
  }, []);

  const handleAdd = useCallback(() => {
    setEditingDoc(null);
    setFormOpen(true);
  }, []);

  const handleArchive = useCallback(
    async (doc: LegalDocumentListItem) => {
      try {
        const res = await updateLegalDocument(doc.id, { status: "archived" });
        toast.success("Document archived");
        handleSaved(res.data);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to archive";
        toast.error(message);
      }
    },
    [handleSaved],
  );

  const handleDelete = useCallback(
    async (doc: LegalDocumentListItem) => {
      if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
      try {
        await deleteLegalDocument(doc.id);
        toast.success("Document deleted");
        setDocs((prev) => prev.filter((d) => d.id !== doc.id));
        setTotalCount((c) => Math.max(0, c - 1));
        void fetchStats();
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to delete";
        toast.error(message);
      }
    },
    [fetchStats, setTotalCount],
  );

  // Bucket `documents` is private, so the raw fileUrl 404s. The
  // preview dialog mints a fresh signed URL on open and renders the
  // file inline (PDF/iframe or image/<img>), falling back to a
  // download button for unsupported types.
  const handlePreview = useCallback((doc: LegalDocumentListItem) => {
    setPreviewDoc(doc);
    setPreviewOpen(true);
  }, []);

  const columns = useMemo(
    () => [
      {
        key: "title",
        header: "Title",
        render: (d: LegalDocumentListItem) => (
          <div className="leading-tight">
            <p className="text-foreground text-xs font-medium">{d.title}</p>
            {d.reference ? (
              <p className="text-muted-foreground text-[11px]">{d.reference}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "kind",
        mobileRole: "field" as const,
        header: "Kind",
        render: (d: LegalDocumentListItem) => (
          <Badge variant="grey">{LEGAL_KIND_LABELS[d.kind] ?? d.kind}</Badge>
        ),
      },
      {
        key: "owner",
        mobileRole: "subtitle" as const,
        header: "Owner",
        render: (d: LegalDocumentListItem) =>
          d.owner ? (
            <div className="leading-tight">
              <p className="text-foreground text-xs">{d.owner.name}</p>
              <p className="text-muted-foreground text-[11px]">
                {d.owner.email}
              </p>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        key: "entity",
        mobileRole: "detail" as const,
        header: "Entity",
        render: (d: LegalDocumentListItem) =>
          d.entity ? (
            <span className="text-foreground text-xs">{d.entity.name}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "folder",
        mobileRole: "detail" as const,
        header: "Folder",
        render: (d: LegalDocumentListItem) =>
          d.folder ? (
            <Badge variant="grey" className="text-[10px]">
              {d.folder}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "expiry",
        mobileRole: "field" as const,
        header: "Expires",
        render: (d: LegalDocumentListItem) => {
          // Prefer the rolled-up expiry across the parent + every
          // attachment so a fresh addendum can keep the contract alive
          // past the original expiryDate.
          const effective = d.effectiveExpiry ?? d.expiryDate;
          const days = daysUntil(effective);
          const tone = expiryCellTone(days, d.renewalLeadDays);
          const isExtended =
            d.effectiveExpiry &&
            d.expiryDate &&
            d.effectiveExpiry !== d.expiryDate;
          return (
            <div className="leading-tight">
              <p
                className={`
                  text-xs
                  ${tone}
                `}
              >
                {effective ?? "—"}
                {isExtended ? (
                  <span
                    className="text-muted-foreground ml-1 text-[10px]"
                    title={`Original expiry ${d.expiryDate}, extended by attachment`}
                  >
                    (extended)
                  </span>
                ) : null}
              </p>
              {days !== null ? (
                <p
                  className={`
                    text-[11px]
                    ${tone}
                  `}
                >
                  {days < 0
                    ? `${Math.abs(days)}d overdue`
                    : days === 0
                      ? "today"
                      : `in ${days}d`}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "status",
        mobileRole: "badge" as const,
        header: "Status",
        render: (d: LegalDocumentListItem) => {
          const status = d.effectiveStatus ?? d.status;
          return (
            <Badge variant={STATUS_VARIANT[status] ?? "grey"}>
              {LEGAL_STATUS_LABELS[status] ?? status}
            </Badge>
          );
        },
      },
      {
        key: "file",
        mobileRole: "detail" as const,
        header: "File",
        render: (d: LegalDocumentListItem) =>
          d.fileUrl ? (
            <button
              type="button"
              className={`
                text-primary text-left text-[11px]
                hover:underline
              `}
              onClick={(e) => {
                e.stopPropagation();
                handlePreview(d);
              }}
            >
              {d.fileName ?? "Open"}
            </button>
          ) : (
            <span className="text-muted-foreground text-[11px]">—</span>
          ),
      },
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        className: "w-10 text-right",
        render: (d: LegalDocumentListItem) => {
          const showAny =
            canUpdate || canDelete || canSignSend || canSignView || canShare;
          if (!showAny) {
            return <span className="text-muted-foreground text-[11px]">—</span>;
          }
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${d.title}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Manage</DropdownMenuLabel>
                {canUpdate && (
                  <DropdownMenuItem onSelect={() => handleEdit(d)}>
                    <FileSignature className="size-3.5" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canShare && (
                  <DropdownMenuItem onSelect={() => handleShare(d)}>
                    <Share2 className="size-3.5" />
                    Share
                  </DropdownMenuItem>
                )}
                {canSignSend && d.status !== "archived" && d.fileUrl && (
                  <DropdownMenuItem onSelect={() => handleSendForSignature(d)}>
                    <Send className="size-3.5" />
                    Send for signature
                  </DropdownMenuItem>
                )}
                {canSignView && (
                  <DropdownMenuItem onSelect={() => handleViewSignatures(d)}>
                    <ListChecks className="size-3.5" />
                    Signatures
                  </DropdownMenuItem>
                )}
                {canUpdate && d.status !== "archived" && (
                  <DropdownMenuItem onSelect={() => void handleArchive(d)}>
                    <AlertTriangle className="size-3.5" />
                    Archive
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => void handleDelete(d)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [
      canUpdate,
      canDelete,
      canSignSend,
      canSignView,
      canShare,
      handleEdit,
      handleArchive,
      handleDelete,
      handlePreview,
      handleSendForSignature,
      handleViewSignatures,
      handleShare,
    ],
  );

  const handleRowClick = useCallback(
    (d: LegalDocumentListItem) => {
      if (!canUpdate) return;
      handleEdit(d);
    },
    [canUpdate, handleEdit],
  );

  if (!canRead) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t have permission to view legal documents.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Legal"
        subtitle="Track licences, agreements and signed documents with expiry alerts"
      >
        <PermissionButton
          variant="outline"
          permission="legal:announcement-read"
          asChild
        >
          <Link href="/legal/announcements">
            <Megaphone className="size-3.5" />
            Announcements
          </Link>
        </PermissionButton>
        <PermissionButton
          variant="outline"
          permission="legal:update"
          onClick={() => setNotifOpen(true)}
        >
          <Bell className="size-3.5" />
          Notification settings
        </PermissionButton>
        <PermissionButton
          variant="accent"
          permission="legal:create"
          onClick={handleAdd}
        >
          <FilePlus className="size-3.5" />
          Add document
        </PermissionButton>
      </PageHeader>

      <div className="flex flex-col gap-4">
        {/* Stats */}
        <div
          className={`
            grid grid-cols-1 gap-3
            md:grid-cols-4
          `}
        >
          <StatCard label="Total" value={stats?.total ?? 0} />
          <StatCard
            label="Expiring (≤30d)"
            value={stats?.expiringSoon ?? 0}
            tone={(stats?.expiringSoon ?? 0) > 0 ? "warning" : undefined}
          />
          <StatCard
            label="Expired"
            value={stats?.expired ?? 0}
            tone={(stats?.expired ?? 0) > 0 ? "danger" : undefined}
          />
          <StatCard label="Archived" value={stats?.archived ?? 0} />
        </div>

        {/* Filters */}
        <div
          className={`
            border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
            shadow-sm
            md:flex-row md:items-center
          `}
        >
          <div className="relative flex-1">
            <Search
              className={`
                text-muted-foreground absolute top-1/2 left-2.5 size-3.5
                -translate-y-1/2
              `}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, reference or counterparty…"
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div
            className={`
              grid grid-cols-2 gap-2
              md:flex md:items-center
            `}
          >
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="h-10 min-w-[140px] text-xs">
                <SelectValue placeholder="Kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All kinds</SelectItem>
                {LEGAL_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {LEGAL_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 min-w-[120px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                {LEGAL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEGAL_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            <Select value={folderFilter} onValueChange={setFolderFilter}>
              <SelectTrigger className="h-10 min-w-[160px] text-xs">
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All folders</SelectItem>
                <SelectItem value="__none__">Ungrouped</SelectItem>
                {folders
                  .filter((f) => f.name)
                  .map((f) => (
                    <SelectItem key={f.name!} value={f.name!}>
                      {f.name} ({f.count})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={docs}
          loading={loading}
          emptyMessage="No legal documents yet"
          onRowClick={canUpdate ? handleRowClick : undefined}
          pagination={
            <DataPagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        />
      </div>

      <LegalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        document={editingDoc}
        entities={entities}
        folders={folders.map((f) => f.name).filter((n): n is string => !!n)}
        onSaved={handleSaved}
      />

      <LegalNotificationSettingsDialog
        open={notifOpen}
        onOpenChange={setNotifOpen}
      />

      <LegalPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        document={previewDoc}
      />

      <SendForSignatureDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        documentId={signingDoc?.id ?? null}
        documentTitle={signingDoc?.title}
        onSent={() => {
          // Re-open the signatures dialog so the user sees the new row.
          setSignaturesOpen(true);
        }}
      />

      <SignaturesDialog
        open={signaturesOpen}
        onOpenChange={setSignaturesOpen}
        documentId={signingDoc?.id ?? null}
        documentTitle={signingDoc?.title}
        canCancel={canSignSend}
      />

      <LegalShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        document={shareDoc}
        onChanged={handleShareChanged}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning" | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="border-border bg-surface rounded-lg border p-4 shadow-sm">
      <p
        className={`
          text-muted-foreground text-[10px] font-bold tracking-widest uppercase
        `}
      >
        {label}
      </p>
      <p
        className={`
          mt-1 text-2xl font-semibold tabular-nums
          ${valueClass}
        `}
      >
        {value}
      </p>
    </div>
  );
}
