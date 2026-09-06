/**
 * IT Helpdesk ↔ GitHub Issues sync (Sid + BD feedback, 2026-05-24).
 *
 * Two flows:
 *
 * 1. Outbound (ticket → issue) — `syncTicketToGithub` posts a new
 *    issue to the configured repo on ticket creation.
 * 2. Inbound (issue / PR webhook → ticket) — `handleWebhookEvent`
 *    advances ticket.status when GitHub reports state changes.
 *
 * All operations are no-ops when `githubEnabled = false`. Token is
 * AES-GCM encrypted at rest via the existing `INTEGRATIONS_TOKEN_KEY`
 * envelope.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { helpdeskTicketStatusEmail } from "@/infrastructure/email/templates";
import { PORTAL_URL } from "@/lib/portal-url";
import { decrypt } from "@/modules/integrations/crypto";

interface GithubSettings {
  enabled: boolean;
  repoOwner: string;
  repoName: string;
  token: string;
  webhookSecret: string;
  labelInProgress: string;
  labelReview: string;
}

async function loadGithubSettings(): Promise<GithubSettings | null> {
  const row = await prisma.helpdeskSettings.findFirst({
    where: { singleton: true },
  });
  if (!row || !row.githubEnabled) return null;
  if (
    !row.githubRepoOwner ||
    !row.githubRepoName ||
    !row.githubTokenEncrypted
  ) {
    return null;
  }
  let token: string;
  try {
    token = decrypt(row.githubTokenEncrypted);
  } catch (err) {
    logger.warn("helpdesk github token decrypt failed", { err });
    return null;
  }
  return {
    enabled: true,
    repoOwner: row.githubRepoOwner,
    repoName: row.githubRepoName,
    token,
    webhookSecret: row.githubWebhookSecret ?? "",
    labelInProgress: row.githubLabelInProgress.toLowerCase(),
    labelReview: row.githubLabelReview.toLowerCase(),
  };
}

const GITHUB_API = "https://api.github.com";

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function ticketBodyForGithub(ticket: {
  id: string;
  ticketNumber: number;
  description: string;
  category: string;
  priority: string;
  attachments: unknown;
  createdBy: { name: string; email: string };
}): string {
  const portalUrl = `${PORTAL_URL}/it-helpdesk?ticket=${ticket.id}`;
  const attachmentLines = Array.isArray(ticket.attachments)
    ? (ticket.attachments as Array<{ name?: string; url?: string }>)
        .filter((a) => a?.url)
        .map((a) => `- [${a.name ?? "attachment"}](${a.url})`)
    : [];
  // Drop email from the visible body — even with the public-repo
  // guard, the issue can be cloned, forked, or screenshotted, so keep
  // raw corporate identifiers out of the long-term GitHub record.
  // Engineers click the portal link to get full reporter context.
  return [
    `**Manut ticket:** [IT-${ticket.ticketNumber}](${portalUrl})`,
    `**Reporter:** ${ticket.createdBy.name}`,
    `**Category:** ${ticket.category}`,
    `**Priority:** ${ticket.priority}`,
    "",
    redactSecrets(ticket.description),
    attachmentLines.length > 0
      ? ["", "**Attachments:**", ...attachmentLines].join("\n")
      : "",
    "",
    `_Synced from Manut IT Helpdesk._`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Best-effort redaction for high-risk patterns IT users routinely
 * paste into a ticket description: passwords ("password: hunter2"),
 * OTP codes, bearer tokens, and email addresses (the user's own +
 * any teammates they CC'd in the description). Not a full PII pass —
 * the public-repo guard remains the real safety net.
 */
function redactSecrets(text: string): string {
  return text
    .replace(/(password|passwd|pwd|pass)\s*[:=]\s*\S+/gi, "$1: [redacted]")
    .replace(
      /\b(otp|2fa|mfa|code)\s*[:=]\s*[0-9A-Z]{4,8}\b/gi,
      "$1: [redacted]",
    )
    .replace(
      /\b(bearer|token)\s*[:=]?\s*[A-Za-z0-9._-]{20,}/gi,
      "$1 [redacted]",
    )
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email redacted]");
}

interface CreatedIssue {
  number: number;
  html_url: string;
}

export async function syncTicketToGithub(ticketId: string): Promise<void> {
  const cfg = await loadGithubSettings();
  if (!cfg) return;

  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id: ticketId },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!ticket) return;
  if (ticket.githubIssueNumber) return;

  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${cfg.repoOwner}/${cfg.repoName}/issues`,
      {
        method: "POST",
        headers: ghHeaders(cfg.token),
        body: JSON.stringify({
          title: `[IT-${ticket.ticketNumber}] ${ticket.title}`,
          body: ticketBodyForGithub(ticket),
          labels: [
            `helpdesk:${ticket.category}`,
            `priority:${ticket.priority}`,
          ],
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      logger.warn("helpdesk github issue create failed", {
        ticketId,
        status: res.status,
        body: text.slice(0, 500),
      });
      return;
    }
    const issue = (await res.json()) as CreatedIssue;
    await prisma.helpdeskTicket.update({
      where: { id: ticketId },
      data: {
        githubIssueNumber: issue.number,
        githubIssueUrl: issue.html_url,
      },
    });
  } catch (err) {
    logger.error("helpdesk github sync threw", { ticketId, err });
  }
}

export function verifyGithubSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const expected =
    "sha256=" +
    createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (expected.length !== signatureHeader.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

interface IssuesEventPayload {
  action: string;
  issue: { number: number; labels?: Array<{ name: string }> };
  label?: { name: string };
}

interface PullRequestEventPayload {
  action: string;
  pull_request: {
    merged: boolean;
    body: string | null;
  };
}

/**
 * Pull "closes #N" / "fixes #N" / "resolves #N" references from a PR
 * body. GitHub's auto-link grammar; we re-implement instead of relying
 * on the API so a PR merge that names the issue informally still wires
 * back to the right ticket.
 */
function extractLinkedIssues(body: string | null | undefined): number[] {
  if (!body) return [];
  const out = new Set<number>();
  const pattern = /(?:closes|fixes|resolves)\s+#(\d+)/gi;
  for (const match of body.matchAll(pattern)) {
    const n = Number(match[1]);
    if (Number.isFinite(n)) out.add(n);
  }
  return Array.from(out);
}

async function transitionTicket(
  issueNumber: number,
  nextStatus: "in-progress" | "review" | "resolved",
): Promise<void> {
  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { githubIssueNumber: issueNumber },
    include: {
      createdBy: { select: { name: true, email: true } },
      assignee: { select: { name: true } },
    },
  });
  if (!ticket) return;
  if (ticket.status === nextStatus) return;
  if (ticket.status === "closed") return;

  const fromStatus = ticket.status;
  const data: {
    status: string;
    resolvedAt?: Date;
    closedAt?: Date;
  } = { status: nextStatus };
  if (nextStatus === "resolved") data.resolvedAt = new Date();

  await prisma.helpdeskTicket.update({ where: { id: ticket.id }, data });

  const settings = await prisma.helpdeskSettings.findFirst({
    where: { singleton: true },
  });
  if (settings?.notifyCreatorOnStatus !== false) {
    try {
      const tpl = helpdeskTicketStatusEmail({
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        recipientName: ticket.createdBy.name,
        fromStatus,
        toStatus: nextStatus,
        assigneeName: ticket.assignee?.name ?? null,
        resolutionNote: ticket.resolutionNote,
        portalUrl: `${PORTAL_URL}/it-helpdesk?ticket=${ticket.id}`,
      });
      void sendEmail({ to: ticket.createdBy.email, ...tpl });
    } catch (err) {
      logger.warn("helpdesk github status email failed", {
        ticketId: ticket.id,
        err,
      });
    }
  }
}

export async function handleGithubWebhookEvent(
  event: string,
  payload: unknown,
): Promise<{ matched: number }> {
  const cfg = await loadGithubSettings();
  if (!cfg) return { matched: 0 };

  if (event === "issues") {
    const body = payload as IssuesEventPayload;
    const action = body.action;
    const issueNumber = body.issue?.number;
    if (!issueNumber) return { matched: 0 };

    if (action === "labeled") {
      const labelName = body.label?.name?.toLowerCase() ?? "";
      if (labelName === cfg.labelInProgress) {
        await transitionTicket(issueNumber, "in-progress");
        return { matched: 1 };
      }
      if (labelName === cfg.labelReview) {
        await transitionTicket(issueNumber, "review");
        return { matched: 1 };
      }
    }

    if (action === "closed") {
      await transitionTicket(issueNumber, "resolved");
      return { matched: 1 };
    }
  }

  if (event === "pull_request") {
    const body = payload as PullRequestEventPayload;
    if (body.action === "closed" && body.pull_request?.merged) {
      const linked = extractLinkedIssues(body.pull_request.body);
      let matched = 0;
      for (const n of linked) {
        await transitionTicket(n, "review");
        matched++;
      }
      return { matched };
    }
  }

  return { matched: 0 };
}

/**
 * Load the webhook secret for HMAC verification. Returned separately
 * from the rest of the config because the webhook controller doesn't
 * need any of the API-token plumbing.
 */
export async function getGithubWebhookSecret(): Promise<string | null> {
  const row = await prisma.helpdeskSettings.findFirst({
    where: { singleton: true },
  });
  return row?.githubWebhookSecret ?? null;
}
