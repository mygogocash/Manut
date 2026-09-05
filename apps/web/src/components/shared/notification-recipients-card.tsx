"use client";

import { Loader2, Mail, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";

interface NotificationRecipientsCardProps {
  title: string;
  description: string;
  placeholder?: string;
  emptyHint?: string;
  /** Fetch current list. Called on mount + after every save. */
  fetcher: () => Promise<{ emails: string[] }>;
  /** Persist the next list. Should return the canonical (server-side) list. */
  persister: (emails: string[]) => Promise<{ emails: string[] }>;
  /** Hide the input + remove buttons; useful for read-only viewers. */
  readOnly?: boolean;
}

/**
 * Admin-managed CC list for module notifications (travel-desk,
 * HR-desk on leave approval, finance-desk on expense approval, etc.).
 * Shipped as a shared card so each module's settings page mounts the
 * same UX without copy-pasting the email-chip widget.
 */
export function NotificationRecipientsCard({
  title,
  description,
  placeholder,
  emptyHint,
  fetcher,
  persister,
  readOnly = false,
}: NotificationRecipientsCardProps) {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetcher();
      setRecipients(res.emails);
    } catch {
      // non-critical — leave empty
    }
  }, [fetcher]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (next: string[]) => {
      try {
        setSaving(true);
        const res = await persister(next);
        setRecipients(res.emails);
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
    if (recipients.includes(email)) {
      setInput("");
      return;
    }
    setInput("");
    void persist([...recipients, email]);
  }

  function removeRecipient(email: string) {
    void persist(recipients.filter((r) => r !== email));
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
      <div className="flex flex-wrap gap-2 pb-3">
        {recipients.length === 0 ? (
          <span className="text-muted-foreground text-xs">
            {emptyHint ??
              "No recipients yet — the summary email is skipped until at least one is added."}
          </span>
        ) : (
          recipients.map((email) => (
            <span
              key={email}
              className={`
                bg-muted text-foreground inline-flex items-center gap-1.5
                rounded-full border px-2.5 py-1 text-xs
              `}
            >
              {email}
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove ${email}`}
                  className={`
                    text-muted-foreground rounded p-0.5
                    hover:text-foreground hover:bg-foreground/10
                  `}
                  onClick={() => removeRecipient(email)}
                  disabled={saving}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))
        )}
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder={placeholder ?? "name@thebinaryholdings.com"}
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
