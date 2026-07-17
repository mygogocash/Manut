"use client";

import {
  ArrowLeft,
  Download,
  Edit2,
  Eye,
  FileText,
  Folder,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  AGREEMENT_TYPE_LABELS,
  AGREEMENT_TYPES,
  type AgreementFolder,
  type AgreementType,
  type EmployeeAgreement,
  getAgreementDownloadUrl,
  getAgreementFolders,
  getAgreements,
} from "@/services/hrms.service";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isExpired(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

interface AgreementsTabProps {
  /** Logged-in user — folder view shows for managers, single-employee view for employees. */
  currentUserId: string;
  canManage: boolean;
  /**
   * Bumped externally after upload / edit / delete so the tab refreshes
   * without exposing reload to parent.
   */
  refreshKey: number;
  onUpload: (employeeId?: string, type?: AgreementType) => void;
  onEdit: (a: EmployeeAgreement) => void;
  onDelete: (a: EmployeeAgreement) => void;
}

export function AgreementsTab({
  currentUserId,
  canManage,
  refreshKey,
  onUpload,
  onEdit,
  onDelete,
}: AgreementsTabProps) {
  const [folders, setFolders] = useState<AgreementFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    canManage ? null : currentUserId,
  );
  const [agreements, setAgreements] = useState<EmployeeAgreement[]>([]);
  const [agreementsLoading, setAgreementsLoading] = useState(false);

  // Folder list (managers only).
  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    void (async () => {
      try {
        setFoldersLoading(true);
        const res = await getAgreementFolders();
        if (!cancelled) setFolders(res.data);
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed to load folders";
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setFoldersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage, refreshKey]);

  // Drilled-in employee's agreements.
  useEffect(() => {
    if (!selectedEmployeeId) {
      setAgreements([]);
      return;
    }
    // Clear stale rows from the previous folder before the next fetch
    // resolves — otherwise the detail view briefly renders the prior
    // employee's documents.
    setAgreements([]);
    let cancelled = false;
    void (async () => {
      try {
        setAgreementsLoading(true);
        const res = await getAgreements({
          employeeId: selectedEmployeeId,
          limit: 100,
        });
        if (!cancelled) setAgreements(res.data);
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed to load agreements";
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setAgreementsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeId, refreshKey]);

  // PDFs / images preview inline in the browser tab; .docx and other
  // binaries trigger a download. Either way the signed-URL endpoint is
  // the only path that re-checks ownership, so View and Download share
  // it.
  //
  // Chrome treats `window.open(...)` after an `await` as a programmatic
  // popup and blocks it — the user-gesture context only survives one
  // microtask. Open a blank tab synchronously while we still have the
  // click context, then redirect it once the signed URL resolves.
  // `noopener` would null out the returned handle, so we strip
  // `tab.opener` manually after the navigation to keep the reverse-
  // tabnabbing protection.
  async function openAgreement(a: EmployeeAgreement) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      toast.error(
        "Popup blocked — allow popups for this site to view documents",
      );
      return;
    }
    try {
      const res = await getAgreementDownloadUrl(a.id);
      tab.opener = null;
      tab.location.href = res.data.url;
    } catch (err) {
      tab.close();
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to open document";
      toast.error(msg);
    }
  }

  const filteredFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => {
      const name = f.employee.name.toLowerCase();
      const email = f.employee.email.toLowerCase();
      const job = (f.employee.jobTitle ?? "").toLowerCase();
      const code = (f.employee.employeeId ?? "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        job.includes(q) ||
        code.includes(q)
      );
    });
  }, [folders, search]);

  // ── Detail view ──────────────────────────────────────────
  if (selectedEmployeeId) {
    const folder =
      folders.find((f) => f.employee.id === selectedEmployeeId) ?? null;
    const employeeName =
      folder?.employee.name ??
      agreements[0]?.employee.name ??
      (canManage ? "Employee" : "Your documents");

    const grouped = new Map<AgreementType, EmployeeAgreement[]>();
    for (const t of AGREEMENT_TYPES) grouped.set(t, []);
    for (const a of agreements) {
      const arr = grouped.get(a.type) ?? [];
      arr.push(a);
      grouped.set(a.type, arr);
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEmployeeId(null)}
            >
              <ArrowLeft className="mr-1 size-3.5" />
              All employees
            </Button>
          )}
          <div className="flex flex-1 items-center gap-3">
            <EmployeeAvatar
              name={employeeName}
              avatarUrl={folder?.employee.avatarUrl ?? null}
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{employeeName}</p>
              <p className="text-muted-foreground truncate text-xs">
                {folder?.employee.jobTitle ?? "—"}
                {folder?.employee.employeeId && (
                  <span className="ml-2 font-mono">
                    {folder.employee.employeeId}
                  </span>
                )}
              </p>
            </div>
          </div>
          {canManage && (
            <Button onClick={() => onUpload(selectedEmployeeId)}>
              <Upload className="mr-1 size-3.5" />
              Upload document
            </Button>
          )}
        </div>

        {agreementsLoading ? (
          <div
            className={`
              text-muted-foreground flex items-center justify-center gap-2 py-12
              text-xs
            `}
          >
            <Loader2 className="size-3.5 animate-spin" />
            Loading documents…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {AGREEMENT_TYPES.map((t) => {
              const items = grouped.get(t) ?? [];
              if (items.length === 0 && !canManage) return null;
              return (
                <section
                  key={t}
                  className={`
                    border-border bg-surface flex flex-col gap-2 rounded-lg
                    border p-3
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">
                        {AGREEMENT_TYPE_LABELS[t]}
                      </p>
                      <Badge variant="secondary" className="text-[11px]">
                        {items.length}
                      </Badge>
                    </div>
                    {canManage && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => onUpload(selectedEmployeeId, t)}
                      >
                        <Plus className="mr-1 size-3" />
                        Add
                      </Button>
                    )}
                  </div>

                  {items.length === 0 ? (
                    <p className="text-muted-foreground py-2 text-xs italic">
                      No documents in this folder.
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y">
                      {items.map((a) => (
                        <div
                          key={a.id}
                          className={`flex items-center gap-3 py-2 text-sm`}
                        >
                          <button
                            type="button"
                            onClick={() => openAgreement(a)}
                            title={`Open ${a.fileName}`}
                            className={`
                              hover:bg-muted/40
                              focus-visible:ring-ring focus-visible:ring-2
                              focus-visible:outline-none
                              flex min-w-0 flex-1 items-center gap-3 rounded-md
                              px-1 py-1 text-left
                            `}
                          >
                            <FileText
                              className={`text-muted-foreground size-4 shrink-0`}
                            />
                            <div className="min-w-0 flex-1">
                              <div
                                className={`
                                  truncate font-medium
                                  group-hover:underline
                                `}
                              >
                                {a.title}
                              </div>
                              <div
                                className={`
                                  text-muted-foreground flex flex-wrap
                                  items-center gap-3 text-[11px]
                                `}
                              >
                                <span className="truncate">{a.fileName}</span>
                                {a.effectiveDate && (
                                  <span>
                                    From {formatDate(a.effectiveDate)}
                                  </span>
                                )}
                                {a.expiryDate && (
                                  <span
                                    className={cn(
                                      isExpired(a.expiryDate) &&
                                        "text-destructive font-medium",
                                    )}
                                  >
                                    {isExpired(a.expiryDate)
                                      ? "Expired "
                                      : "Expires "}
                                    {formatDate(a.expiryDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="View"
                              title="Open in a new tab"
                              onClick={() => openAgreement(a)}
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Download"
                              title={a.fileName}
                              onClick={() => openAgreement(a)}
                            >
                              <Download className="size-3.5" />
                            </Button>
                            {canManage && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => onEdit(a)}
                                  aria-label="Edit"
                                >
                                  <Edit2 className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => onDelete(a)}
                                  aria-label="Delete"
                                >
                                  <Trash2 className="text-destructive size-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Folder list (managers) ───────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div
        className={`
          border-border bg-surface flex items-center gap-2 rounded-lg border p-3
          shadow-sm
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
            placeholder="Search employee, email, job, ID…"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <Button onClick={() => onUpload()}>
          <Upload className="size-3.5" />
          Upload agreement
        </Button>
      </div>

      {foldersLoading ? (
        <div
          className={`
            text-muted-foreground flex items-center justify-center gap-2 py-12
            text-xs
          `}
        >
          <Loader2 className="size-3.5 animate-spin" />
          Loading folders…
        </div>
      ) : filteredFolders.length === 0 ? (
        <div
          className={`
            border-border bg-surface flex flex-col items-center justify-center
            gap-2 rounded-lg border py-10 text-center
          `}
        >
          <Folder className="text-muted-foreground size-6" />
          <p className="text-sm font-medium">No employees match</p>
          <p className="text-muted-foreground text-xs">
            {search ? "Adjust the search query" : "No active employees yet"}
          </p>
        </div>
      ) : (
        <div
          className={`
            grid grid-cols-1 gap-3
            sm:grid-cols-2
            lg:grid-cols-3
            xl:grid-cols-4
          `}
        >
          {filteredFolders.map((f) => (
            <FolderCard
              key={f.employee.id}
              folder={f}
              onOpen={() => setSelectedEmployeeId(f.employee.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderCard({
  folder,
  onOpen,
}: {
  folder: AgreementFolder;
  onOpen: () => void;
}) {
  const topTypes = AGREEMENT_TYPES.filter(
    (t) => (folder.byType[t] ?? 0) > 0,
  ).slice(0, 4);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`
        border-border bg-surface flex flex-col gap-3 rounded-lg border p-4
        text-left transition-colors
        hover:border-primary/40 hover:bg-primary/5
        focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:outline-none
      `}
    >
      <div className="flex items-start gap-3">
        <EmployeeAvatar
          name={folder.employee.name}
          avatarUrl={folder.employee.avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {folder.employee.name}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {folder.employee.jobTitle ?? folder.employee.email}
          </p>
        </div>
        <Folder className="text-muted-foreground size-4 shrink-0" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="text-[11px]">
          {folder.total} document{folder.total === 1 ? "" : "s"}
        </Badge>
        {topTypes.map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px]">
            {AGREEMENT_TYPE_LABELS[t]} · {folder.byType[t]}
          </Badge>
        ))}
      </div>
      {folder.lastUpdatedAt && (
        <p className="text-muted-foreground text-[11px]">
          Updated {formatDate(folder.lastUpdatedAt)}
        </p>
      )}
    </button>
  );
}

function EmployeeAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <div
        className={`
          bg-muted relative h-10 w-10 shrink-0 overflow-hidden rounded-full
        `}
      >
        <Image src={avatarUrl} alt={name} fill sizes="40px" />
      </div>
    );
  }
  return (
    <div
      className={`
        bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center
        justify-center rounded-full text-xs font-semibold
      `}
    >
      {initials(name) || "?"}
    </div>
  );
}
