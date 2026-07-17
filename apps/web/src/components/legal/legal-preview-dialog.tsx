"use client";

import { Download, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import { trackDocumentDownloaded } from "@/lib/events";
import {
  getLegalDownloadUrl,
  type LegalDocumentListItem,
} from "@/services/legal.service";

interface LegalPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: LegalDocumentListItem | null;
}

function extOf(name: string | null | undefined): string {
  if (!name) return "";
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function isPdf(ext: string): boolean {
  return ext === "pdf";
}

function isImage(ext: string): boolean {
  return ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
}

// In-app preview for legal documents. The `documents` Supabase bucket
// is private, so we fetch a short-lived signed URL via the API every
// time the dialog opens. PDFs render in an iframe; images render via
// <img>; anything else falls back to an "Open in new tab" CTA.
export function LegalPreviewDialog({
  open,
  onOpenChange,
  document,
}: LegalPreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !document?.id) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await getLegalDownloadUrl(document.id);
        if (!cancelled) {
          setUrl(res.data.url);
          trackDocumentDownloaded({
            document_id: document.id,
            document_kind: "legal",
          });
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : "Failed to load preview";
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, document?.id]);

  const ext = extOf(document?.fileName);
  const canEmbedPdf = isPdf(ext);
  const canEmbedImage = isImage(ext);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          flex max-h-[92vh] flex-col gap-3 p-0
          sm:max-w-5xl
        `}
      >
        <DialogHeader className="border-border border-b px-5 py-3">
          <DialogTitle className="text-base">
            {document?.title ?? "Preview"}
          </DialogTitle>
          {document?.fileName ? (
            <div className="text-muted-foreground truncate text-xs">
              {document.fileName}
            </div>
          ) : null}
        </DialogHeader>

        <div className="relative flex min-h-[60vh] flex-1 items-stretch">
          {loading ? (
            <div
              className={`
                text-muted-foreground absolute inset-0 flex items-center
                justify-center gap-2 text-sm
              `}
            >
              <Loader2 className="size-4 animate-spin" />
              Loading preview…
            </div>
          ) : null}

          {!loading && error ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm">
              {error}
            </div>
          ) : null}

          {!loading && !error && url && canEmbedPdf ? (
            <iframe
              src={url}
              title={document?.title ?? "Legal document"}
              className="h-full min-h-[60vh] w-full"
            />
          ) : null}

          {!loading && !error && url && canEmbedImage ? (
            <div
              className={`
                flex h-full w-full items-center justify-center bg-black/5 p-3
              `}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={document?.title ?? "Legal document"}
                className="max-h-[75vh] max-w-full object-contain"
              />
            </div>
          ) : null}

          {!loading && !error && url && !canEmbedPdf && !canEmbedImage ? (
            <div
              className={`
                flex flex-1 flex-col items-center justify-center gap-3 p-6
                text-center
              `}
            >
              <p className="text-muted-foreground text-sm">
                Preview isn&apos;t supported for this file type ({ext || "—"}).
              </p>
              <Button asChild size="sm">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Download className="size-3.5" />
                  Download
                </a>
              </Button>
            </div>
          ) : null}
        </div>

        <div
          className={`
            border-border flex items-center justify-end gap-2 border-t px-5 py-3
          `}
        >
          {url ? (
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                Open in new tab
              </a>
            </Button>
          ) : null}
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
