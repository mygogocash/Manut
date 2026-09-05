"use client";

import { Bell, Loader2, Mail, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import {
  getVisaNotificationConfig,
  setVisaNotificationLeadDays,
  setVisaNotificationNotifyEmployee,
  setVisaNotificationRecipients,
} from "@/services/visa.service";

/**
 * Visa expiry reminder config. Admin-managed:
 *   - HR / admin email recipient list (CC'd on every reminder along with
 *     the employee).
 *   - Lead-day milestones (e.g. 90 / 60 / 30 / 14 / 7 days before
 *     expiry). Cron fires at most one email per record per milestone
 *     bucket — moving the record into a closer bucket re-pings.
 *
 * Recipients UI mirrors `<NotificationRecipientsCard>` for travel /
 * leave / expense; the lead-day editor is inline since visa is the
 * only module that exposes the milestone list to admins so far.
 */
export function VisaNotificationConfigCard() {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [leadDays, setLeadDays] = useState<number[]>([]);
  const [notifyEmployee, setNotifyEmployee] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [dayInput, setDayInput] = useState("");
  const [savingRecipients, setSavingRecipients] = useState(false);
  const [savingDays, setSavingDays] = useState(false);
  const [savingNotifyEmployee, setSavingNotifyEmployee] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getVisaNotificationConfig();
      setRecipients(res.data.emails);
      setLeadDays(res.data.leadDays);
      setNotifyEmployee(res.data.notifyEmployee);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persistRecipients = useCallback(async (next: string[]) => {
    try {
      setSavingRecipients(true);
      const res = await setVisaNotificationRecipients(next);
      setRecipients(res.data.emails);
      toast.success("Notification recipients updated");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to update recipients";
      toast.error(msg);
    } finally {
      setSavingRecipients(false);
    }
  }, []);

  const persistNotifyEmployee = useCallback(
    async (next: boolean) => {
      const previous = notifyEmployee;
      setNotifyEmployee(next);
      if (!next && recipients.length === 0) {
        toast.warning(
          "No HR recipients set — reminders will not be sent until you add one or re-enable employee delivery.",
        );
      }
      try {
        setSavingNotifyEmployee(true);
        const res = await setVisaNotificationNotifyEmployee(next);
        setNotifyEmployee(res.data.notifyEmployee);
        toast.success(
          res.data.notifyEmployee
            ? "Employee will receive reminders"
            : "Employee will no longer receive reminders",
        );
      } catch (err) {
        setNotifyEmployee(previous);
        const msg =
          err instanceof ApiError ? err.message : "Failed to update setting";
        toast.error(msg);
      } finally {
        setSavingNotifyEmployee(false);
      }
    },
    [notifyEmployee, recipients.length],
  );

  const persistDays = useCallback(async (next: number[]) => {
    try {
      setSavingDays(true);
      const res = await setVisaNotificationLeadDays(next);
      setLeadDays(res.data.leadDays);
      toast.success("Reminder schedule updated");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to update schedule";
      toast.error(msg);
    } finally {
      setSavingDays(false);
    }
  }, []);

  function addEmail() {
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

  function removeEmail(email: string) {
    void persistRecipients(recipients.filter((r) => r !== email));
  }

  function addDay() {
    const n = Math.floor(Number(dayInput));
    if (!Number.isFinite(n) || n <= 0 || n > 3650) {
      toast.error("Enter a positive number of days (e.g. 90)");
      return;
    }
    if (leadDays.includes(n)) {
      setDayInput("");
      return;
    }
    setDayInput("");
    void persistDays([...leadDays, n]);
  }

  function removeDay(n: number) {
    if (leadDays.length === 1) {
      toast.error("At least one lead day is required");
      return;
    }
    void persistDays(leadDays.filter((d) => d !== n));
  }

  return (
    <div className="bg-card rounded-md border p-5">
      <div className="mb-4 flex items-start gap-2">
        <Bell className="text-muted-foreground mt-0.5 h-4 w-4" />
        <div>
          <h3 className="text-foreground text-sm font-semibold">
            Expiry-reminder settings
          </h3>
          <p className="text-muted-foreground text-xs">
            Cron runs daily and dispatches a reminder whenever a visa or work
            permit enters a new lead-day bucket. Use the controls below to
            choose who receives it.
          </p>
        </div>
      </div>

      {/* Notify the visa holder */}
      <div className="border-border mb-4 rounded-md border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <UserCheck className="text-muted-foreground mt-0.5 h-3.5 w-3.5" />
            <div>
              <p className="text-foreground text-xs font-medium">
                Send reminders to the employee
              </p>
              <p className="text-muted-foreground text-[11px]">
                When on, the visa holder (or sponsor employee for dependent
                records) is mailed directly. Turn off if HR should be the only
                recipient — e.g. for sensitive expat cases.
              </p>
            </div>
          </div>
          <Switch
            checked={notifyEmployee}
            onCheckedChange={persistNotifyEmployee}
            disabled={savingNotifyEmployee}
            aria-label="Send reminders to the employee"
          />
        </div>
        {!notifyEmployee && recipients.length === 0 && (
          <p className="mt-2 text-[11px] text-amber-500">
            No HR recipients set — reminders are currently being skipped for
            every record.
          </p>
        )}
      </div>

      {/* Recipients */}
      <div className="border-border mb-4 rounded-md border p-3">
        <div className="mb-2 flex items-start gap-2">
          <Mail className="text-muted-foreground mt-0.5 h-3.5 w-3.5" />
          <div>
            <p className="text-foreground text-xs font-medium">
              HR / admin recipients
            </p>
            <p className="text-muted-foreground text-[11px]">
              These addresses receive a CC on every visa / work-permit reminder.
              {notifyEmployee
                ? " Leave empty to mail the employee only."
                : " Required while “Send to employee” is off."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pb-2">
          {recipients.length === 0 ? (
            <span className="text-muted-foreground text-xs">
              {notifyEmployee
                ? "No recipients yet — only the employee gets the reminder."
                : "No recipients yet — reminders are being skipped."}
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
                <button
                  type="button"
                  aria-label={`Remove ${email}`}
                  className={`
                    text-muted-foreground rounded p-0.5
                    hover:text-foreground hover:bg-foreground/10
                  `}
                  onClick={() => removeEmail(email)}
                  disabled={savingRecipients}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="hr@thebinaryholdings.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addEmail();
              }
            }}
            disabled={savingRecipients}
          />
          <Button onClick={addEmail} disabled={savingRecipients}>
            {savingRecipients ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            Add
          </Button>
        </div>
      </div>

      {/* Lead days */}
      <div className="border-border rounded-md border p-3">
        <p className="text-foreground text-xs font-medium">
          Reminder lead days
        </p>
        <p className="text-muted-foreground text-[11px]">
          Each value is a &quot;days before expiry&quot; milestone. The cron
          emails when a record crosses into a closer bucket and never re-fires
          for the same bucket. Default: 90 / 60 / 30 / 14 / 7.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 pb-2">
          {leadDays.length === 0 ? (
            <span className="text-muted-foreground text-xs">
              No lead days configured — reminders disabled.
            </span>
          ) : (
            leadDays.map((n) => (
              <span
                key={n}
                className={`
                  bg-muted text-foreground inline-flex items-center gap-1.5
                  rounded-full border px-2.5 py-1 text-xs tabular-nums
                `}
              >
                {n}d
                <button
                  type="button"
                  aria-label={`Remove ${n}-day reminder`}
                  className={`
                    text-muted-foreground rounded p-0.5
                    hover:text-foreground hover:bg-foreground/10
                  `}
                  onClick={() => removeDay(n)}
                  disabled={savingDays}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={3650}
            placeholder="e.g. 30"
            value={dayInput}
            onChange={(e) => setDayInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDay();
              }
            }}
            disabled={savingDays}
          />
          <Button onClick={addDay} disabled={savingDays}>
            {savingDays ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
