import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { itBillingReminderEmail } from "@/infrastructure/email/templates";
import { PORTAL_URL } from "@/lib/portal-url";
import { itBillingRepository } from "@/modules/it-billing/it-billing.repository";
import { EXPIRING_SOON_DAYS } from "@/modules/it-billing/it-billing.service";

const DAY = 24 * 60 * 60 * 1000;
const PORTAL = `${PORTAL_URL}/it-operations/billing`;

/** Renewal rungs (days out) + the payment-due rung. */
const RENEWAL_RUNGS = [30, 15, 7] as const;
const PAYMENT_RUNG = 7;

function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / DAY);
}

/**
 * Scan subscriptions and fire renewal (30/15/7) + payment-due (7) alerts.
 * Idempotent + debounced: each rung records a marker in `reminders_sent`
 * so re-running the cron the same day is a no-op. Safe to re-run.
 */
export async function processBillingReminders(): Promise<{
  scanned: number;
  alertsCreated: number;
  emailsSent: number;
}> {
  const horizon = new Date(Date.now() + 30 * DAY);
  const subs = await itBillingRepository.subscriptionsForReminderScan(horizon);

  let alertsCreated = 0;
  let emailsSent = 0;

  for (const sub of subs) {
    // Once an admin has recorded a renew/cancel decision for this cycle,
    // stop nagging - the decision re-arms the ladder (clears reminders_sent).
    if (sub.renewalDecision) continue;

    const sent = new Set<string>(
      Array.isArray(sub.remindersSent) ? (sub.remindersSent as string[]) : [],
    );
    const newMarkers: string[] = [];
    const fired: Array<{
      type: string;
      message: string;
      days: number;
      kind: "renewal" | "payment";
    }> = [];

    // Renewal ladder.
    const renewalIn = daysUntil(sub.renewalDate);
    if (renewalIn !== null && renewalIn >= 0) {
      for (const rung of RENEWAL_RUNGS) {
        const marker = `renewal-${rung}`;
        if (renewalIn <= rung && !sent.has(marker)) {
          newMarkers.push(marker);
          fired.push({
            type: marker,
            kind: "renewal",
            days: renewalIn,
            message: `${sub.productName} renews in ${renewalIn} day(s)`,
          });
          break; // fire the nearest unfired rung only
        }
      }
    }

    // Payment-due ladder (only when there's an active payment obligation).
    if (
      (sub.paymentStatus === "pending" || sub.paymentStatus === "overdue") &&
      renewalIn !== null &&
      renewalIn >= 0 &&
      renewalIn <= PAYMENT_RUNG &&
      !sent.has("payment-due-7")
    ) {
      newMarkers.push("payment-due-7");
      fired.push({
        type: "payment-due-7",
        kind: "payment",
        days: renewalIn,
        message: `Payment for ${sub.productName} is due within ${PAYMENT_RUNG} day(s)`,
      });
    }

    if (fired.length === 0) continue;

    for (const f of fired) {
      await itBillingRepository.createAlert({
        subscriptionId: sub.id,
        alertType: f.type,
        message: f.message,
      });
      alertsCreated += 1;

      if (sub.owner?.email) {
        const mail = itBillingReminderEmail({
          recipientName: sub.owner.name,
          productName: sub.productName,
          vendorName: "", // vendor not loaded in scan include; kept minimal
          kind: f.kind,
          daysLeft: f.days,
          amount: `${sub.currency} ${Number(sub.invoiceAmount).toLocaleString()}`,
          portalUrl: PORTAL,
        });
        void sendEmail({ to: sub.owner.email, ...mail });
        emailsSent += 1;
      }
    }

    await prisma.itSubscription.update({
      where: { id: sub.id },
      data: {
        remindersSent: [...sent, ...newMarkers],
        lastReminderSentAt: new Date(),
        ...(renewalIn !== null &&
        renewalIn >= 0 &&
        renewalIn <= EXPIRING_SOON_DAYS
          ? { status: "expiring-soon" }
          : {}),
      },
    });
  }

  return { scanned: subs.length, alertsCreated, emailsSent };
}
