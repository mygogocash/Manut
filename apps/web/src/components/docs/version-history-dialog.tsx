"use client";

import { format } from "date-fns";
import { History, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RichTextViewer } from "@/components/shared/rich-text-editor";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import {
  getWikiPageVersion,
  listWikiPageVersions,
  restoreWikiPageVersion,
  type WikiPage,
  type WikiPageVersion,
  type WikiPageVersionListItem,
} from "@/services/docs.service";

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string | null;
  pageTitle: string;
  canRestore: boolean;
  onRestored?: (page: WikiPage) => void;
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  pageId,
  pageTitle,
  canRestore,
  onRestored,
}: VersionHistoryDialogProps) {
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<WikiPageVersionListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<WikiPageVersion | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [restoreTarget, setRestoreTarget] =
    useState<WikiPageVersionListItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!open || !pageId) return;
    let cancelled = false;
    setLoading(true);
    listWikiPageVersions(pageId)
      .then((res) => {
        if (cancelled) return;
        setVersions(res.data);
        setSelectedId(res.data[0]?.id ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : "Failed to load history";
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pageId]);

  useEffect(() => {
    if (!open || !pageId || !selectedId) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getWikiPageVersion(pageId, selectedId)
      .then((res) => {
        if (!cancelled) setSelected(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : "Failed to load version";
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pageId, selectedId]);

  async function handleRestore() {
    if (!restoreTarget || !pageId) return;
    try {
      setRestoring(true);
      const res = await restoreWikiPageVersion(pageId, restoreTarget.id);
      toast.success(`Restored version ${restoreTarget.version}`);
      onRestored?.(res.data);
      setRestoreTarget(null);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to restore";
      toast.error(message);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          flex max-h-[85vh] flex-col
          sm:max-w-4xl
        `}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> Version history
          </DialogTitle>
          <DialogDescription>
            Older snapshots of {pageTitle}. Each save creates a new entry.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`
            grid flex-1 grid-cols-1 gap-3 overflow-hidden
            md:grid-cols-[260px_1fr]
          `}
        >
          <aside
            className={`
              border-border flex flex-col gap-1 overflow-y-auto rounded-md
              border p-2
            `}
          >
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No history yet — edit the page to start one.
              </p>
            ) : (
              versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  className={`
                    flex flex-col items-start gap-0.5 rounded-md px-2 py-1.5
                    text-left text-[12px]
                    ${
                      selectedId === v.id
                        ? "bg-accent text-accent-foreground"
                        : `hover:bg-muted/40`
                    }
                  `}
                >
                  <span className="font-medium">v{v.version}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {format(new Date(v.createdAt), "MMM d, yyyy HH:mm")}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {v.createdBy.name}
                  </span>
                </button>
              ))
            )}
          </aside>

          <main className="flex flex-col overflow-hidden">
            {detailLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              </div>
            ) : selected ? (
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{selected.title}</h3>
                    <p className="text-muted-foreground text-[11px]">
                      v{selected.version} · saved{" "}
                      {format(
                        new Date(selected.createdAt),
                        "MMM d, yyyy HH:mm",
                      )}{" "}
                      by {selected.createdBy.name}
                    </p>
                  </div>
                  {canRestore ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setRestoreTarget({
                          id: selected.id,
                          version: selected.version,
                          title: selected.title,
                          createdAt: selected.createdAt,
                          createdBy: selected.createdBy,
                        })
                      }
                    >
                      <RotateCcw className="size-3.5" /> Restore
                    </Button>
                  ) : null}
                </header>
                <div
                  className={`
                    border-border bg-muted/30 rounded-md border p-3 text-sm
                    leading-relaxed
                  `}
                >
                  <RichTextViewer html={selected.body} />
                </div>
              </div>
            ) : (
              <div
                className={`
                  text-muted-foreground flex flex-1 items-center justify-center
                  text-xs
                `}
              >
                Pick a version on the left to preview.
              </div>
            )}
          </main>
        </div>
      </DialogContent>

      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(next) => {
          if (!restoring && !next) setRestoreTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore v{restoreTarget?.version}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The current page will be replaced with this snapshot. The current
              state is saved as a new version first, so this is undoable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring}>
              {restoring ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : null}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
