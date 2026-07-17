"use client";

import { Bell, Loader2, Mail, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import {
  getVisaNotificationConfig,
  setVisaNotificationRecipients,
} from "@/services/visa.service";

/**
 * 90-day TM.47 reminder config. The cron fires emails at three fixed
 * milestones derived from the applicant's last arrival date:
 *   - T-21d   first heads-up
 *   - T-15d   advance-submission window opens
 *   - T+7d    final report day (TM.47 deadline is 7 days past day 90)
 *
 * Each email is sent to the applicant's own address plus the CC list
 * managed here. The CC list shares the same `visa.notification_recipients`
 * SystemSetting key as the Visa Tracker config, so editing it here also
 * updates the Visa Tracker reminders (and vice-versa).
 */
export function NinetyDayNotificationConfigCard() {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getVisaNotificationConfig();
      setRecipients(res.data.emails);
    } catch {
      // non-critical — the page still works without the list loaded.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistRecipients(next: string[]) {
    try {
      setSaving(true);
      const res = await setVisaNotificationRecipients(next);
      setRecipients(res.data.emails);
      toast.success("Recipient list updated");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update recipients";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function addRecipient() {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    if (recipients.includes(email)) {
      setEmailInput("");
      return;
    }
    setEmailInput("");
    void persistRecipients([...recipients, email]);
  }

  function removeRecipient(email: string) {
    void persistRecipients(recipients.filter((r) => r !== email));
  }

  return (
    <section
      className={`
        border-border bg-card flex flex-col gap-3 rounded-lg border p-4
      `}
    >
      <header className="flex items-start gap-3">
        <div
          className={`
            bg-primary/12 text-primary flex size-9 shrink-0 items-center
            justify-center rounded-lg
          `}
        >
          <Bell className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-foreground text-sm font-semibold">
            90-day reminder recipients
          </h3>
          <p className="text-muted-foreground mt-0.5 text-[12px]">
            Cron fires three emails per applicant — T-21, T-15, and T+7 days
            relative to the 90-day TM.47 due date. Each one CCs the addresses
            below and goes to the applicant&apos;s own email.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        {recipients.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {recipients.map((email) => (
              <li
                key={email}
                className={`
                  bg-muted/40 border-border inline-flex items-center gap-1.5
                  rounded-md border px-2 py-1 text-xs
                `}
              >
                <Mail className="text-muted-foreground size-3" aria-hidden />
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => removeRecipient(email)}
                  aria-label={`Remove ${email}`}
                  className={`
                    text-muted-foreground
                    hover:text-destructive
                  `}
                  disabled={saving}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">
            No CC recipients configured. The applicant still receives every
            reminder; HR / leadership won&apos;t.
          </p>
        )}
        <div className="flex gap-2">
          <Input
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRecipient();
              }
            }}
            placeholder="name@manut.example"
            disabled={saving}
            className="h-8 text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addRecipient}
            disabled={saving || !emailInput.trim()}
          >
            {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Add
          </Button>
        </div>
      </div>
    </section>
  );
}
