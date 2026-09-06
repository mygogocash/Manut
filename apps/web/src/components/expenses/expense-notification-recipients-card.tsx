"use client";

import { Loader2, Mail, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import type {
  ExpenseRecipient,
  ExpenseRecipientMode,
} from "@/services/expense.service";

// Variant of the shared `NotificationRecipientsCard` that adds a
// per-row trigger dropdown (`approved` vs `everything`). Lives in
// the expenses folder rather than `shared/` because the mode column
// is module-specific — leave and travel-desk lists are still plain
// email arrays and have no equivalent toggle.
interface Props {
  title: string;
  description: string;
  placeholder?: string;
  fetcher: () => Promise<{ recipients: ExpenseRecipient[] }>;
  persister: (
    recipients: ExpenseRecipient[],
  ) => Promise<{ recipients: ExpenseRecipient[] }>;
  readOnly?: boolean;
}

const MODE_LABELS: Record<ExpenseRecipientMode, string> = {
  approved: "Approved only",
  everything: "Every event",
};

const MODE_HINTS: Record<ExpenseRecipientMode, string> = {
  approved:
    "Email on final approval only — the long-form summary used by the payroll team to disburse.",
  everything:
    "Also email at submit time so finance can plan the next batch before the approval chain finishes.",
};

export function ExpenseNotificationRecipientsCard({
  title,
  description,
  placeholder,
  fetcher,
  persister,
  readOnly = false,
}: Props) {
  const [recipients, setRecipients] = useState<ExpenseRecipient[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetcher();
      setRecipients(res.recipients);
    } catch {
      // non-critical — leave empty
    }
  }, [fetcher]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (next: ExpenseRecipient[]) => {
      try {
        setSaving(true);
        const res = await persister(next);
        setRecipients(res.recipients);
        toast.success("Notification recipients updated");
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to update recipients";
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [persister],
  );

  function addRecipient() {
    const email = input.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    if (recipients.some((r) => r.email === email)) {
      setInput("");
      return;
    }
    setInput("");
    // New rows default to `approved` — least-surprise behavior. Admin
    // flips the dropdown to `everything` for finance staff who want
    // submit-time visibility.
    void persist([...recipients, { email, mode: "approved" }]);
  }

  function removeRecipient(email: string) {
    void persist(recipients.filter((r) => r.email !== email));
  }

  function changeMode(email: string, mode: ExpenseRecipientMode) {
    void persist(
      recipients.map((r) => (r.email === email ? { ...r, mode } : r)),
    );
  }

  return (
    <div className="bg-card mt-6 rounded-md border p-5">
      <div className="mb-3 flex items-start gap-2">
        <Mail className="text-muted-foreground mt-0.5 h-4 w-4" />
        <div>
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>

      <div className="space-y-2 pb-3">
        {recipients.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No recipients yet — the summary email is skipped until at least one
            is added.
          </p>
        ) : (
          recipients.map((r) => (
            <div
              key={r.email}
              className={`
                bg-muted/40 flex flex-wrap items-center gap-3 rounded-md border
                px-3 py-2
              `}
            >
              <span className="text-foreground text-sm">{r.email}</span>
              {!readOnly && (
                <>
                  <Select
                    value={r.mode}
                    onValueChange={(v) =>
                      changeMode(r.email, v as ExpenseRecipientMode)
                    }
                    disabled={saving}
                  >
                    <SelectTrigger className="h-7 w-[160px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MODE_LABELS) as ExpenseRecipientMode[]).map(
                        (m) => (
                          <SelectItem key={m} value={m} className="text-xs">
                            {MODE_LABELS[m]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-[11px]">
                    {MODE_HINTS[r.mode]}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${r.email}`}
                    className={`
                      text-muted-foreground ml-auto rounded p-1
                      hover:text-foreground hover:bg-foreground/10
                    `}
                    onClick={() => removeRecipient(r.email)}
                    disabled={saving}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder={placeholder ?? "name@manut.xyz"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRecipient();
              }
            }}
            disabled={saving}
          />
          <Button onClick={addRecipient} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
