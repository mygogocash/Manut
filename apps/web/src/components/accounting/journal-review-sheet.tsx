"use client";

import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { Badge } from "@/components/shared/badge";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  approveJournal,
  type JournalEntryDetail,
  postJournal,
  rejectJournal,
} from "@/services/accounting.service";

interface JournalReviewSheetProps {
  journal: JournalEntryDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canApprove: boolean;
  canPost: boolean;
  onChanged: () => void;
}

export function JournalReviewSheet({
  journal,
  open,
  onOpenChange,
  canApprove,
  canPost,
  onChanged,
}: JournalReviewSheetProps) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setRejecting(false);
      setRejectReason("");
      setPosting(false);
    }
  }, [open]);

  async function runAction(
    action: () => Promise<unknown>,
    successMessage: string,
  ) {
    try {
      setBusy(true);
      await action();
      toast.success(successMessage);
      onChanged();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Review action failed",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!journal) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className={`
            w-full overflow-y-auto
            sm:max-w-2xl
          `}
        >
          <SheetHeader className="border-border border-b px-6 py-5">
            <div className="flex items-center gap-2">
              <Badge status={journal.status}>{journal.status}</Badge>
              <span className="text-muted-foreground text-xs">
                {journal.entity.name}
              </span>
            </div>
            <SheetTitle className="font-serif text-2xl">
              {journal.reference || "Journal review"}
            </SheetTitle>
            <SheetDescription>
              {formatDate(journal.date)} · Prepared by {journal.creator.name}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-6 pb-6">
            <section
              className={`
                grid grid-cols-2 gap-3 pt-2
                sm:grid-cols-4
              `}
            >
              <Metric
                label="Debit"
                value={formatCurrency(journal.totalDebit)}
              />
              <Metric
                label="Credit"
                value={formatCurrency(journal.totalCredit)}
              />
              <Metric label="Currency" value={journal.entity.currency} />
              <Metric
                label="Age"
                value={`${Math.max(
                  0,
                  Math.floor(
                    (Date.now() - new Date(journal.createdAt).getTime()) /
                      86_400_000,
                  ),
                )} days`}
              />
            </section>

            <section>
              <p
                className={`
                  text-muted-foreground mb-1 text-xs font-medium uppercase
                `}
              >
                Description
              </p>
              <p className="text-sm">
                {journal.description ?? journal.descriptionTh ?? "—"}
              </p>
            </section>

            {journal.status === "rejected" && journal.rejectReason ? (
              <section
                className={`
                  border-destructive/20 bg-destructive/5 rounded-lg border p-4
                `}
              >
                <p className="text-destructive text-xs font-semibold uppercase">
                  Returned for correction
                </p>
                <p className="mt-1 text-sm">{journal.rejectReason}</p>
              </section>
            ) : null}

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold">
                  Journal lines
                </h3>
                <span className="text-muted-foreground text-xs">
                  {journal.lines.length} lines
                </span>
              </div>
              <div className="border-border overflow-hidden rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Account
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Memo</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Debit
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {journal.lines.map((line) => (
                      <tr key={line.id} className="border-border border-t">
                        <td className="px-3 py-2">
                          <span className="font-medium">
                            {line.account.code}
                          </span>
                          <span className="text-muted-foreground ml-1.5">
                            {line.account.name}
                          </span>
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {line.memo || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(line.debit) > 0
                            ? formatCurrency(line.debit)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(line.credit) > 0
                            ? formatCurrency(line.credit)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {rejecting ? (
              <section className="border-border space-y-3 rounded-lg border p-4">
                <div>
                  <p className="font-heading text-sm font-semibold">
                    Return for correction
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Reason becomes visible to accounting staff correcting entry.
                  </p>
                </div>
                <Textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Explain account, amount, or documentation issue…"
                  maxLength={1000}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRejecting(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={!rejectReason.trim() || busy}
                    onClick={() =>
                      void runAction(
                        () => rejectJournal(journal.id, rejectReason.trim()),
                        "Journal returned for correction",
                      )
                    }
                  >
                    Confirm rejection
                  </Button>
                </div>
              </section>
            ) : null}
          </div>

          <SheetFooter
            className={`
              border-border bg-background sticky bottom-0 border-t px-6 py-4
            `}
          >
            {journal.status === "draft" && canApprove ? (
              <div className="flex w-full gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => setRejecting(true)}
                >
                  <XCircle className="size-4" />
                  Reject
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () => approveJournal(journal.id),
                      "Journal approved",
                    )
                  }
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Approve
                </Button>
              </div>
            ) : null}
            {journal.status === "approved" && canPost ? (
              <Button className="w-full" onClick={() => setPosting(true)}>
                <Send className="size-4" />
                Post to ledger
              </Button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={posting} onOpenChange={setPosting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post journal to ledger?</AlertDialogTitle>
            <AlertDialogDescription>
              Posting updates account balances and makes entry immutable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => postJournal(journal.id),
                  "Journal posted to ledger",
                )
              }
            >
              Post journal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg px-3 py-3">
      <p className="text-muted-foreground text-[10px] font-medium uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
