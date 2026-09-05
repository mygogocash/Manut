"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { PermissionButton } from "@/components/shared/permission-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiError } from "@/lib/api-client";
import {
  getInvestor,
  type Investor,
  INVESTOR_TYPE_LABELS,
  type InvestorDetail,
  investorStatusLabel,
} from "@/services/investor.service";

interface InvestorDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorId: string | null;
  onEdit?: (investor: Investor) => void;
}

// Right-rail quick view for the Investor Dashboard. Mirrors the
// AccountDetailSheet pattern from sales-crm — same Sheet primitive,
// same edit handoff. Fetches the full InvestorDetail (which includes
// the related investments[]) on open and clears on close so a stale
// previous row never flashes.
export function InvestorDetailSheet({
  open,
  onOpenChange,
  investorId,
  onEdit,
}: InvestorDetailSheetProps) {
  const [investor, setInvestor] = useState<InvestorDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!investorId) return;
    try {
      setLoading(true);
      const res = await getInvestor(investorId);
      setInvestor(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load investor";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => {
    if (!open || !investorId) return;
    void fetchData();
  }, [open, investorId, fetchData]);

  useEffect(() => {
    if (!open) setInvestor(null);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={`
          flex w-full flex-col gap-0
          sm:max-w-xl
        `}
      >
        <SheetHeader className="border-border border-b">
          <SheetTitle>
            {investor ? investor.name : loading ? "Loading…" : "Investor"}
          </SheetTitle>
          <SheetDescription>
            {investor
              ? `${INVESTOR_TYPE_LABELS[investor.type] ?? investor.type} · ${investorStatusLabel(
                  investor.status,
                )}`
              : "Investor detail"}
          </SheetDescription>
        </SheetHeader>

        {loading && !investor ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : investor ? (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
            <section className="flex flex-col gap-2">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Status
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge status={investor.status}>
                  {investorStatusLabel(investor.status)}
                </Badge>
                <Badge status={investor.type}>
                  {INVESTOR_TYPE_LABELS[investor.type] ?? investor.type}
                </Badge>
              </div>
            </section>

            <DetailGrid
              rows={[
                ["Key contact", investor.contactName],
                ["Title", investor.title],
                ["Email", investor.contactEmail],
                ["Phone", investor.contactPhone],
                ["Location", investor.location],
                ["Region", investor.region],
                [
                  "LinkedIn",
                  investor.linkedinUrl ? (
                    <a
                      href={investor.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`
                        text-primary text-xs break-all
                        hover:underline
                      `}
                    >
                      {investor.linkedinUrl}
                    </a>
                  ) : null,
                ],
                [
                  "Website",
                  investor.website ? (
                    <a
                      href={investor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`
                        text-primary text-xs break-all
                        hover:underline
                      `}
                    >
                      {investor.website}
                    </a>
                  ) : null,
                ],
              ]}
            />

            <section className="flex flex-col gap-2">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Pipeline
              </p>
              <DetailGrid
                inline
                rows={[
                  ["Revenue stream", investor.revenueStream],
                  [
                    "Last contact",
                    investor.lastContactDate
                      ? new Date(investor.lastContactDate).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )
                      : null,
                  ],
                  ["Next action", investor.nextAction],
                  ["Act. investment", investor.actInvestment],
                  ["Est. investment", investor.estInvestment],
                  ["Cross-sell", investor.crossSell],
                ]}
              />
            </section>

            {investor.notesText ? (
              <section className="flex flex-col gap-2">
                <p
                  className={`
                    text-muted-foreground text-[10px] font-bold tracking-widest
                    uppercase
                  `}
                >
                  Notes
                </p>
                {/*
                  `whitespace-pre-wrap` keeps the newlines the team writes in
                  their notes; `break-words` stops a long unbroken URL from
                  forcing the whole sheet to scroll sideways. Both are needed
                  — pre-wrap alone will not break inside a single long token.
                */}
                <p
                  className={`
                    text-foreground text-xs break-words whitespace-pre-wrap
                  `}
                >
                  {investor.notesText}
                </p>
              </section>
            ) : null}

            <section className="flex flex-col gap-2">
              <p
                className={`
                  text-muted-foreground text-[10px] font-bold tracking-widest
                  uppercase
                `}
              >
                Investments ({investor.investments?.length ?? 0})
              </p>
              {!investor.investments || investor.investments.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No investments recorded yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {investor.investments.map((inv) => (
                    <li
                      key={inv.id}
                      className={`
                        border-border bg-background flex items-center
                        justify-between gap-2 rounded-md border px-2 py-1.5
                      `}
                    >
                      <div className="flex flex-col">
                        <span className="text-foreground text-xs font-medium">
                          {inv.round || inv.currency}
                        </span>
                        <span
                          className={`
                            text-muted-foreground text-[11px] tabular-nums
                          `}
                        >
                          {inv.currency} {Number(inv.amount).toLocaleString()} ·{" "}
                          {new Date(inv.date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <Badge status={inv.status}>{inv.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-muted-foreground text-[10px]">
              Added by {investor.adder?.name ?? "—"} ·{" "}
              {new Date(investor.createdAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        ) : null}

        {investor && onEdit ? (
          <div
            className={`
              border-border flex flex-wrap items-center justify-end gap-2
              border-t p-4
            `}
          >
            <PermissionButton
              permission="investors:update"
              variant="outline"
              onClick={() => onEdit(investor)}
            >
              Edit
            </PermissionButton>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// Two-column key/value layout. `inline` switches to a tighter
// flex-wrap variant for nested grids (e.g. pipeline section).
function DetailGrid({
  rows,
  inline,
}: {
  rows: Array<[string, React.ReactNode]>;
  inline?: boolean;
}) {
  const visible = rows.filter(
    ([, val]) =>
      val !== null && val !== undefined && val !== "" && val !== false,
  );
  if (visible.length === 0) return null;
  return (
    <dl
      className={
        inline
          ? "grid grid-cols-2 gap-x-3 gap-y-1.5"
          : "grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5"
      }
    >
      {visible.map(([label, val]) => (
        <div
          key={label}
          className={inline ? "flex flex-col gap-0.5" : "contents"}
        >
          <dt
            className={`
              text-muted-foreground text-[10px] font-bold tracking-widest
              uppercase
            `}
          >
            {label}
          </dt>
          <dd className="text-foreground text-xs break-words">{val}</dd>
        </div>
      ))}
    </dl>
  );
}
