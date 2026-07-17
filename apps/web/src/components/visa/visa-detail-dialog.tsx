"use client";

import { differenceInDays, format } from "date-fns";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisaChecklistPanel } from "@/components/visa/visa-checklist-panel";
import { VisaKbPanel } from "@/components/visa/visa-kb-panel";
import { VisaTimelinePanel } from "@/components/visa/visa-timeline-panel";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  getVisaDownloadUrl,
  VISA_DOCUMENT_CATEGORY_LABELS,
  VISA_STATUS_LABELS,
  VISA_TYPE_LABELS,
  type VisaDocument,
  type VisaRecord,
} from "@/services/visa.service";

interface VisaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visa: VisaRecord | null;
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return format(new Date(String(d).slice(0, 10) + "T00:00:00"), "MMM d, yyyy");
}

function ExpiryRow({
  label,
  date,
}: {
  label: string;
  date: string | null | undefined;
}) {
  if (!date) {
    return (
      <div>
        <div
          className={`text-muted-foreground text-[10px] tracking-wide uppercase`}
        >
          {label}
        </div>
        <div className="text-foreground text-sm font-medium">—</div>
      </div>
    );
  }
  const days = differenceInDays(new Date(date), new Date());
  const tone =
    days < 0 ? "red" : days <= 14 ? "red" : days <= 90 ? "amber" : null;
  return (
    <div>
      <div className="text-muted-foreground text-[10px] tracking-wide uppercase">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-foreground text-sm font-medium">{fmt(date)}</span>
        {tone ? (
          <Badge variant={tone}>
            {days < 0
              ? `Expired ${Math.abs(days)}d ago`
              : `${days} day${days === 1 ? "" : "s"} left`}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

interface DocumentRowProps {
  visaId: string;
  doc: VisaDocument;
  index: number;
}

function DocumentRow({ visaId, doc, index }: DocumentRowProps) {
  const [loading, setLoading] = useState(false);

  async function open() {
    try {
      setLoading(true);
      const res = await getVisaDownloadUrl(visaId, index);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to open document";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`
        border-border/60 flex items-center justify-between gap-2 rounded-md
        border p-2
      `}
    >
      <div className="min-w-0">
        <div className="text-foreground truncate text-sm font-medium">
          {VISA_DOCUMENT_CATEGORY_LABELS[doc.category] ?? "Document"}
        </div>
        <div className="text-muted-foreground truncate text-xs">{doc.name}</div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={open}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        Open
      </Button>
    </div>
  );
}

export function VisaDetailDialog({
  open,
  onOpenChange,
  visa,
}: VisaDetailDialogProps) {
  const { hasPermission } = useAuth();
  if (!visa) return null;

  // Timeline, checklist + KB guidance are HR-desk only (visa:manage).
  const isHrDesk = hasPermission("visa:manage");

  const docs = Array.isArray(visa.documents) ? visa.documents : [];

  async function openLegacyDoc() {
    if (!visa?.documentUrl) return;
    try {
      const res = await getVisaDownloadUrl(visa.id);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to open document";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-xl
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {visa.holderType === "dependent"
              ? (visa.holderName ?? "Dependent")
              : (visa.employee?.name ?? "Visa record")}
          </DialogTitle>
          <DialogDescription>
            {VISA_TYPE_LABELS[visa.visaType] ?? visa.visaType} · {visa.country}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div
                className={`
                  text-muted-foreground text-[10px] tracking-wide uppercase
                `}
              >
                {visa.holderType === "dependent" ? "Holder" : "Employee"}
              </div>
              <div className="text-foreground font-medium">
                {visa.holderType === "dependent"
                  ? (visa.holderName ?? "—")
                  : (visa.employee?.name ?? "—")}
              </div>
              {visa.holderType === "dependent" ? (
                <div className="text-muted-foreground text-xs">
                  {visa.holderRelationship
                    ? `${visa.holderRelationship} of ${visa.employee?.name ?? "—"}`
                    : `Dependent of ${visa.employee?.name ?? "—"}`}
                </div>
              ) : visa.employee?.email ? (
                <div className="text-muted-foreground text-xs">
                  {visa.employee.email}
                </div>
              ) : null}
            </div>
            <div>
              <div
                className={`
                  text-muted-foreground text-[10px] tracking-wide uppercase
                `}
              >
                Status
              </div>
              <Badge status={visa.status}>
                {VISA_STATUS_LABELS[visa.status] ?? visa.status}
              </Badge>
            </div>
            <div>
              <div
                className={`
                  text-muted-foreground text-[10px] tracking-wide uppercase
                `}
              >
                Visa type
              </div>
              <div className="text-foreground font-medium">
                {VISA_TYPE_LABELS[visa.visaType] ?? visa.visaType}
              </div>
            </div>
            <div>
              <div
                className={`
                  text-muted-foreground text-[10px] tracking-wide uppercase
                `}
              >
                Country of Issue
              </div>
              <div className="text-foreground font-medium">{visa.country}</div>
            </div>
            <div>
              <div
                className={`
                  text-muted-foreground text-[10px] tracking-wide uppercase
                `}
              >
                Nationality
              </div>
              <div className="text-foreground font-medium">
                {visa.nationality ?? "—"}
              </div>
            </div>
            <div>
              <div
                className={`
                  text-muted-foreground text-[10px] tracking-wide uppercase
                `}
              >
                Entity
              </div>
              <div className="text-foreground font-medium">
                {visa.entity?.name ?? "—"}
              </div>
            </div>
          </div>

          <div className="border-border/60 rounded-md border p-3">
            <div className="text-foreground mb-2 text-sm font-semibold">
              Visa validity
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ExpiryRow label="Issue date" date={visa.issueDate} />
              <ExpiryRow label="Expiry date" date={visa.expiryDate} />
            </div>
          </div>

          {(visa.workPermitNumber ||
            visa.workPermitIssueDate ||
            visa.workPermitExpiryDate) && (
            <div className="border-border/60 rounded-md border p-3">
              <div className="text-foreground mb-2 text-sm font-semibold">
                Work permit
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div
                    className={`
                      text-muted-foreground text-[10px] tracking-wide uppercase
                    `}
                  >
                    Permit number
                  </div>
                  <div className="text-foreground font-medium">
                    {visa.workPermitNumber ?? "—"}
                  </div>
                </div>
                <div />
                <ExpiryRow label="Issue date" date={visa.workPermitIssueDate} />
                <ExpiryRow
                  label="Expiry date"
                  date={visa.workPermitExpiryDate}
                />
              </div>
            </div>
          )}

          <div className="border-border/60 rounded-md border p-3">
            <div className="text-foreground mb-2 text-sm font-semibold">
              Documents
            </div>
            {docs.length === 0 && !visa.documentUrl ? (
              <p className="text-muted-foreground text-xs">
                No documents attached.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {docs.map((d, i) => (
                  <DocumentRow
                    key={`${d.category}-${i}`}
                    visaId={visa.id}
                    doc={d}
                    index={i}
                  />
                ))}
                {docs.length === 0 && visa.documentUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={openLegacyDoc}
                    className="w-fit"
                  >
                    <ExternalLink className="size-3.5" />
                    Open attached document
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          {visa.notes ? (
            <div>
              <div
                className={`
                  text-muted-foreground text-[10px] tracking-wide uppercase
                `}
              >
                Notes
              </div>
              <p className="text-foreground mt-1 text-sm whitespace-pre-wrap">
                {visa.notes}
              </p>
            </div>
          ) : null}

          {isHrDesk && open ? <VisaTimelinePanel visaId={visa.id} /> : null}

          {isHrDesk && open ? <VisaChecklistPanel visaId={visa.id} /> : null}

          {isHrDesk && open ? (
            <VisaKbPanel country={visa.country} visaType={visa.visaType} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
