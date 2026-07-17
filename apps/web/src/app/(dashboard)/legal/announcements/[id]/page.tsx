"use client";

import { ArrowLeft, CheckCircle2, FileText, Loader2, Pin } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { sanitizeRichHtml } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  ackAnnouncement,
  ANNOUNCEMENT_KIND_LABELS,
  ANNOUNCEMENT_STATUS_LABELS,
  type AnnouncementAcker,
  getAnnouncement,
  getAnnouncementAttachmentUrl,
  type LegalAnnouncement,
  listAnnouncementAckers,
} from "@/services/legal-announcements.service";

const STATUS_VARIANT: Record<
  string,
  "green" | "red" | "grey" | "blue" | "gold"
> = {
  draft: "grey",
  published: "green",
  archived: "grey",
};

export default function LegalAnnouncementDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { hasPermission } = useAuth();
  const canRead = hasPermission("legal:announcement-read");
  const canManage = hasPermission("legal:announcement-manage");

  const [doc, setDoc] = useState<LegalAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);
  const [ackBusy, setAckBusy] = useState(false);
  const [ackers, setAckers] = useState<AnnouncementAcker[]>([]);
  const [ackersLoading, setAckersLoading] = useState(false);

  const fetchDoc = useCallback(async () => {
    if (!id || !canRead) return;
    try {
      setLoading(true);
      const res = await getAnnouncement(id);
      setDoc(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load announcement";
      toast.error(message);
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [id, canRead]);

  useEffect(() => {
    void fetchDoc();
  }, [fetchDoc]);

  useEffect(() => {
    if (!doc || !canManage) return;
    setAckersLoading(true);
    listAnnouncementAckers(doc.id)
      .then((res) => setAckers(res.data))
      .catch(() => setAckers([]))
      .finally(() => setAckersLoading(false));
  }, [doc, canManage]);

  const handleAck = useCallback(async () => {
    if (!doc) return;
    try {
      setAckBusy(true);
      const res = await ackAnnouncement(doc.id);
      if (res.data) setDoc(res.data);
      toast.success("Acknowledged");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to acknowledge";
      toast.error(message);
    } finally {
      setAckBusy(false);
    }
  }, [doc]);

  const handleDownload = useCallback(
    async (attachmentId: string) => {
      if (!doc) return;
      try {
        const res = await getAnnouncementAttachmentUrl(doc.id, attachmentId);
        window.open(res.data.url, "_blank", "noopener,noreferrer");
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to open file";
        toast.error(message);
      }
    },
    [doc],
  );

  if (!canRead) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t have permission to view legal announcements.
      </div>
    );
  }

  if (loading) {
    return (
      <p className="text-muted-foreground py-12 text-center text-xs">
        Loading…
      </p>
    );
  }

  if (!doc) {
    return (
      <p className="text-muted-foreground py-12 text-center text-xs">
        Announcement not found.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/legal/announcements"
          className={`
            text-muted-foreground inline-flex items-center gap-1 text-xs
            hover:underline
          `}
        >
          <ArrowLeft className="size-3.5" />
          Back to announcements
        </Link>
      </div>

      <PageHeader title={doc.title}>
        {doc.requiresAck && !doc.myAckedAt && doc.status === "published" ? (
          <Button onClick={() => void handleAck()} disabled={ackBusy}>
            {ackBusy && <Loader2 className="mr-2 size-3.5 animate-spin" />}
            <CheckCircle2 className="size-3.5" />
            Acknowledge
          </Button>
        ) : null}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {doc.pinned ? <Pin className="text-bronze size-3.5" /> : null}
        <Badge variant={STATUS_VARIANT[doc.status] ?? "grey"}>
          {ANNOUNCEMENT_STATUS_LABELS[doc.status]}
        </Badge>
        <Badge variant="grey">{ANNOUNCEMENT_KIND_LABELS[doc.kind]}</Badge>
        {doc.entity ? <Badge variant="blue">{doc.entity.name}</Badge> : null}
        {doc.requiresAck ? <Badge variant="gold">Ack required</Badge> : null}
        {doc.myAckedAt ? (
          <span
            className={`text-success inline-flex items-center gap-1 text-[11px]`}
          >
            <CheckCircle2 className="size-3.5" />
            You acknowledged on {doc.myAckedAt.slice(0, 10)}
          </span>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-2 text-[11px]">
        {doc.author ? `By ${doc.author.name} · ` : ""}
        {doc.publishedAt
          ? `Published ${doc.publishedAt.slice(0, 10)}`
          : "Not yet published"}
        {doc.expiresAt ? ` · expires ${doc.expiresAt.slice(0, 10)}` : ""}
      </p>

      <article
        className="prose prose-sm mt-6 max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(doc.body) }}
      />

      {doc.attachments.length > 0 && (
        <section className="mt-6">
          <h2 className="text-foreground text-sm font-semibold">Attachments</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {doc.attachments.map((att) => (
              <li key={att.id}>
                <button
                  type="button"
                  className={`
                    border-border bg-surface inline-flex items-center gap-2
                    rounded-md border px-3 py-2 text-xs
                    hover:bg-bronze/5
                  `}
                  onClick={() => void handleDownload(att.id)}
                >
                  <FileText className="text-bronze size-4" />
                  {att.fileName}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && doc.requiresAck && (
        <section className="mt-8">
          <h2 className="text-foreground text-sm font-semibold">
            Acknowledgments ({doc.ackCount})
          </h2>
          {ackersLoading ? (
            <p className="text-muted-foreground mt-2 text-xs">Loading…</p>
          ) : ackers.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-xs">
              No one has acknowledged yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y rounded-md border">
              {ackers.map((a) => (
                <li
                  key={a.userId}
                  className={`
                    flex items-center justify-between px-3 py-2 text-xs
                  `}
                >
                  <div>
                    <p className="text-foreground font-medium">
                      {a.user?.name ?? a.userId}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {a.user?.email ?? ""}
                      {a.user?.entity ? ` · ${a.user.entity.name}` : ""}
                    </p>
                  </div>
                  <span className="text-muted-foreground">
                    {a.ackedAt.slice(0, 10)} {a.ackedAt.slice(11, 16)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
