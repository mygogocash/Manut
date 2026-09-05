/**
 * Sales CRM email auto-sync (Sid + BD feedback, 2026-05-24).
 *
 * For every user with a connected Gmail account, list messages sent
 * or received since their last sync cursor, match the participating
 * email addresses against `Contact.email` (CRM accounts directory),
 * and insert a `CrmActivity` row of `type="email"` for each matched
 * recipient. The result: any email a BD rep sends to a known account
 * — or any reply that account sends back — shows up on the account's
 * activity timeline without manual logging.
 *
 * Dedup is enforced by `CrmActivity.externalRef = "gmail:{msgId}"`
 * with a unique constraint, so re-runs of the cron are safe even if
 * the cursor overlaps the previous window.
 *
 * Triggered by `POST /api/cron/crm-email-sync` (Cloud Scheduler).
 */
import type { Prisma } from "@nexora/database";

import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { integrationsService } from "@/modules/integrations/integrations.service";

const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;

const ANGLE_ADDR = /<([^>]+)>/;
const BARE_ADDR = /([\w.+-]+@[\w.-]+\.[\w]+)/i;

/**
 * Extract pure email addresses from a header value that may carry
 * display names + multiple comma-separated entries.
 */
function extractEmails(headerValue: string | null | undefined): string[] {
  if (!headerValue) return [];
  const out: string[] = [];
  for (const entry of headerValue.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const angle = ANGLE_ADDR.exec(trimmed);
    const candidate = angle ? angle[1]! : trimmed;
    const bare = BARE_ADDR.exec(candidate);
    if (bare) out.push(bare[1]!.toLowerCase());
  }
  return out;
}

interface ParticipantMatch {
  contactId: string;
  accountId: string;
  email: string;
}

async function matchContactsByEmail(
  emails: string[],
): Promise<Map<string, ParticipantMatch>> {
  const out = new Map<string, ParticipantMatch>();
  if (emails.length === 0) return out;
  const rows = await prisma.contact.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, email: true, accountId: true },
  });
  for (const row of rows) {
    const key = row.email?.toLowerCase();
    if (!key) continue;
    if (out.has(key)) continue;
    out.set(key, {
      contactId: row.id,
      accountId: row.accountId,
      email: key,
    });
  }
  return out;
}

interface SyncResult {
  userId: string;
  scanned: number;
  matched: number;
  skipped: number;
  failed: number;
  cursorBefore: Date;
  cursorAfter: Date;
}

export async function syncCrmEmailsForUser(
  userId: string,
): Promise<SyncResult> {
  const connection = await prisma.userGoogleConnection.findUnique({
    where: { userId },
    select: { lastCrmEmailSyncAt: true },
  });
  if (!connection) {
    return {
      userId,
      scanned: 0,
      matched: 0,
      skipped: 0,
      failed: 0,
      cursorBefore: new Date(0),
      cursorAfter: new Date(),
    };
  }

  const now = new Date();
  const cursorBefore =
    connection.lastCrmEmailSyncAt ??
    new Date(now.getTime() - FIRST_RUN_LOOKBACK_MS);

  const afterUnix = Math.floor(cursorBefore.getTime() / 1000);
  const q = `after:${afterUnix}`;

  let scanned = 0;
  let matched = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const list = await integrationsService.listGmail(userId, {
      q,
      pageSize: PAGE_SIZE,
    });
    scanned = list.data.length;

    for (const msg of list.data) {
      const id = msg.id;
      if (!id) continue;

      const participantEmails = [
        ...extractEmails(msg.from),
        ...extractEmails(msg.to),
      ];
      if (participantEmails.length === 0) continue;

      const contacts = await matchContactsByEmail(participantEmails);
      if (contacts.size === 0) continue;

      // One activity row per matched contact — the same email on a
      // 3-recipient thread shows up on each participating account's
      // timeline. `externalRef` carries the contact id so the unique
      // constraint stays contact-scoped.
      for (const match of contacts.values()) {
        try {
          await prisma.crmActivity.create({
            data: {
              type: "email",
              subject: msg.subject ?? "(no subject)",
              body: msg.snippet ?? null,
              occurredAt: msg.date ? new Date(msg.date) : now,
              ownerId: userId,
              contactId: match.contactId,
              accountId: match.accountId,
              externalRef: `gmail:${id}:${match.contactId}`,
            },
          });
          matched++;
        } catch (err) {
          if ((err as { code?: string }).code === "P2002") {
            skipped++;
            continue;
          }
          failed++;
          logger.error("crm-email-sync activity insert failed", {
            userId,
            messageId: id,
            err,
          });
        }
      }
    }

    await prisma.userGoogleConnection.update({
      where: { userId },
      data: { lastCrmEmailSyncAt: now },
    });
  } catch (err) {
    logger.error("crm-email-sync list failed", { userId, err });
    failed++;
  }

  return {
    userId,
    scanned,
    matched,
    skipped,
    failed,
    cursorBefore,
    cursorAfter: now,
  };
}

interface DispatcherResult {
  users: number;
  scanned: number;
  matched: number;
  skipped: number;
  failed: number;
}

export async function syncCrmEmailsForAllUsers(): Promise<DispatcherResult> {
  const connections = await prisma.userGoogleConnection.findMany({
    select: { userId: true },
  });

  const agg: DispatcherResult = {
    users: connections.length,
    scanned: 0,
    matched: 0,
    skipped: 0,
    failed: 0,
  };

  for (const c of connections) {
    try {
      const r = await syncCrmEmailsForUser(c.userId);
      agg.scanned += r.scanned;
      agg.matched += r.matched;
      agg.skipped += r.skipped;
      agg.failed += r.failed;
    } catch (err) {
      agg.failed++;
      logger.error("crm-email-sync per-user wrapper failed", {
        userId: c.userId,
        err,
      });
    }
  }

  return agg;
}

export type CrmActivityCreate = Prisma.CrmActivityCreateInput;
