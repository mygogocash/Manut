"use client";

import {
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Folder,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  Presentation,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { NotConnectedBanner } from "@/components/integrations/not-connected-banner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  type DriveFile,
  getIntegrationsStatus,
  listDrive,
} from "@/services/integrations.service";

// Drive-style icon + accent colour per mime family. Keeps the grid card
// scannable the way Google's own UI is: green for sheets, blue for
// docs, orange for slides, grey for unknown.
function fileIconFor(file: DriveFile): {
  Icon: typeof Folder;
  tone: string;
} {
  const t = (file.type || file.mimeType || "").toLowerCase();
  if (t.includes("folder")) return { Icon: Folder, tone: "text-amber-500" };
  if (t.includes("spreadsheet") || t.includes("xlsx")) {
    return { Icon: FileSpreadsheet, tone: "text-emerald-600" };
  }
  if (t.includes("presentation") || t.includes("slides")) {
    return { Icon: Presentation, tone: "text-orange-500" };
  }
  if (t.includes("image") || t.includes("png") || t.includes("jpg")) {
    return { Icon: ImageIcon, tone: "text-purple-500" };
  }
  if (t.includes("document") || t.includes("doc")) {
    return { Icon: FileText, tone: "text-sky-600" };
  }
  return { Icon: FileText, tone: "text-muted-foreground" };
}

function isGoogleNotConnected(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 412 &&
    err.code === "GOOGLE_NOT_CONNECTED"
  );
}

function formatModified(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const now = new Date();
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return "Today";
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

const DRIVE_AUTO_REFRESH_MS = 120_000;

type ViewMode = "grid" | "list";

export default function DrivePage() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [rawText, setRawText] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notConnected, setNotConnected] = useState(false);
  const [view, setView] = useState<ViewMode>("grid");

  useEffect(() => {
    void getIntegrationsStatus()
      .then((res) => setNotConnected(!res.data.google.connected))
      .catch(() => {});
  }, []);

  const load = useCallback(async (q?: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await listDrive(q);
      setFiles(res.data ?? []);
      setRawText(res.raw);
      setNextPageToken(res.nextPageToken ?? null);
      setNotConnected(false);
    } catch (err) {
      if (isGoogleNotConnected(err)) {
        setNotConnected(true);
      } else if (!silent) {
        const message =
          err instanceof ApiError ? err.message : "Failed to load files";
        toast.error(message);
      }
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await listDrive(query, { pageToken: nextPageToken });
      setFiles((prev) => [...prev, ...(res.data ?? [])]);
      setNextPageToken(res.nextPageToken ?? null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load more files";
      toast.error(message);
    } finally {
      setLoadingMore(false);
    }
  }, [query, nextPageToken, loadingMore]);

  useEffect(() => {
    if (notConnected) return;
    void load();
  }, [notConnected, load]);

  useEffect(() => {
    if (notConnected) return;
    if (typeof document === "undefined") return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void load(query, { silent: true });
    };
    const interval = window.setInterval(tick, DRIVE_AUTO_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [notConnected, query, load]);

  // Drive groups folders ahead of files in its own UI; mirror that
  // ordering for the suggested-files / suggested-folders split.
  const { folders, regularFiles } = useMemo(() => {
    const f: DriveFile[] = [];
    const r: DriveFile[] = [];
    for (const file of files) {
      const t = (file.type || file.mimeType || "").toLowerCase();
      if (t.includes("folder")) f.push(file);
      else r.push(file);
    }
    return { folders: f, regularFiles: r };
  }, [files]);

  return (
    <div>
      <PageHeader
        title="Google Drive"
        subtitle="Your Google Workspace files through Manut-owned OAuth"
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() => void load(query)}
          disabled={loading || notConnected}
        >
          {loading || refreshing ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 size-3.5" />
          )}
          Refresh
        </Button>
      </PageHeader>

      {notConnected && (
        <div className="mb-4">
          <NotConnectedBanner feature="Drive" />
        </div>
      )}

      {/* Drive's search bar is the prominent affordance; a pill with the
          magnifier inside, full width across the page. */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className={`
              text-muted-foreground pointer-events-none absolute top-1/2 left-3
              size-4 -translate-y-1/2
            `}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load(query);
            }}
            placeholder="Search in Drive"
            className="bg-muted/40 h-10 border-transparent pl-9 text-sm"
            disabled={notConnected}
          />
        </div>
        <div
          className={`
            border-border inline-flex items-center overflow-hidden rounded-md
            border
          `}
        >
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Grid view"
            className={cn(
              "px-2.5 py-2 text-xs",
              view === "grid"
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted",
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="List view"
            className={cn(
              "px-2.5 py-2 text-xs",
              view === "list"
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted",
            )}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground py-12 text-center text-sm">
          <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
          Loading files…
        </div>
      ) : files.length === 0 ? (
        <div className="text-muted-foreground py-16 text-center">
          <Folder className="mx-auto mb-3 size-8 opacity-50" />
          <p className="text-sm">{rawText ? rawText : "No files to show"}</p>
        </div>
      ) : view === "grid" ? (
        <div className="flex flex-col gap-6">
          {folders.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Folders ({folders.length})
              </h3>
              <DriveGrid files={folders} compact />
            </section>
          )}
          {regularFiles.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Files ({regularFiles.length})
              </h3>
              <DriveGrid files={regularFiles} />
            </section>
          )}
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Modified</TableHead>
                <TableHead className="w-20">Size</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((f, i) => {
                const { Icon, tone } = fileIconFor(f);
                return (
                  <TableRow key={f.id || i}>
                    <TableCell>
                      <Icon className={cn("size-4", tone)} />
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {f.webViewLink ? (
                        <a
                          href={f.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {f.name || "—"}
                        </a>
                      ) : (
                        (f.name ?? "—")
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatModified(f.modifiedTime || f.modified || "")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {f.size || "—"}
                    </TableCell>
                    <TableCell>
                      {f.webViewLink && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                        >
                          <a
                            href={f.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open
                            <ExternalLink className="ml-1 size-3" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && files.length > 0 && nextPageToken ? (
        <div className="mt-4 flex justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DriveGrid({
  files,
  compact = false,
}: {
  files: DriveFile[];
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        compact
          ? `
            grid-cols-2
            sm:grid-cols-3
            md:grid-cols-4
            lg:grid-cols-5
          `
          : `
            grid-cols-1
            sm:grid-cols-2
            md:grid-cols-3
            lg:grid-cols-4
          `,
      )}
    >
      {files.map((f, i) => {
        const { Icon, tone } = fileIconFor(f);
        const modified = formatModified(f.modifiedTime || f.modified || "");
        const inner = (
          <div
            className={cn(
              `
                bg-card group flex flex-col overflow-hidden rounded-lg border
                transition-colors
                hover:border-foreground/20
              `,
              compact ? "" : "",
            )}
          >
            {!compact && (
              <div
                className={`
                  bg-muted/30 flex aspect-[16/10] items-center justify-center
                `}
              >
                <Icon className={cn("size-10 opacity-60", tone)} />
              </div>
            )}
            <div
              className={cn(
                "flex items-center gap-2 px-3",
                compact ? "py-2.5" : "py-2",
              )}
            >
              {compact && <Icon className={cn("size-4 shrink-0", tone)} />}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-foreground truncate text-xs font-medium`}
                  title={f.name || ""}
                >
                  {f.name || "—"}
                </p>
                {!compact && (
                  <p className="text-muted-foreground text-[11px]">
                    {modified}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
        return f.webViewLink ? (
          <a
            key={f.id || i}
            href={f.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            {inner}
          </a>
        ) : (
          <div key={f.id || i}>{inner}</div>
        );
      })}
    </div>
  );
}
