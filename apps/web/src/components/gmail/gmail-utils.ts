import type { GmailMessage } from "@/services/integrations.service";

/** Extract bare email from `"Name" <addr@x.com>` or `addr@x.com`. */
export function parseEmailAddress(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const angle = trimmed.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  const email = trimmed.match(/[^\s,;<>]+@[^\s,;<>]+/);
  return email ? email[0].toLowerCase() : trimmed.toLowerCase();
}

/** Split RFC 2822 address lists on commas outside angle brackets. */
export function parseEmailList(raw: string): string[] {
  if (!raw.trim()) return [];
  const parts: string[] = [];
  let current = "";
  let inAngle = false;
  for (const ch of raw) {
    if (ch === "<") inAngle = true;
    if (ch === ">") inAngle = false;
    if ((ch === "," || ch === ";") && !inAngle) {
      if (current.trim()) parts.push(parseEmailAddress(current));
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(parseEmailAddress(current));
  return [...new Set(parts.filter(Boolean))];
}

export function joinEmailList(emails: string[]): string {
  return emails.join(", ");
}

function normalizeSubjectPrefix(subject: string, prefix: string): string {
  const trimmed = subject.trim();
  const re = new RegExp(`^${prefix}\\s*`, "i");
  if (re.test(trimmed)) return trimmed;
  return `${prefix} ${trimmed}`;
}

export function buildReplySubject(subject: string): string {
  return normalizeSubjectPrefix(subject || "(no subject)", "Re:");
}

export function buildForwardSubject(subject: string): string {
  return normalizeSubjectPrefix(subject || "(no subject)", "Fwd:");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildQuotedHtml(email: GmailMessage): string {
  const header = [
    `<br><br>---------- Original message ----------<br>`,
    `<b>From:</b> ${escapeHtml(email.from)}<br>`,
    `<b>Date:</b> ${escapeHtml(email.date)}<br>`,
    `<b>Subject:</b> ${escapeHtml(email.subject)}<br>`,
    `<b>To:</b> ${escapeHtml(email.to)}<br>`,
    email.cc ? `<b>Cc:</b> ${escapeHtml(email.cc)}<br>` : "",
  ].join("");
  const body = email.bodyHtml?.trim()
    ? `<blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${email.bodyHtml}</blockquote>`
    : `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(email.bodyText || "")}</pre>`;
  return `<p><br></p>${header}${body}`;
}

export type ComposeMode = "new" | "reply" | "replyAll" | "forward";

export interface ComposeDraft {
  mode: ComposeMode;
  to: string;
  cc: string;
  subject: string;
  bodyHtml: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
}

export function buildComposeDraft(
  mode: ComposeMode,
  email: GmailMessage,
  myEmail?: string,
): ComposeDraft {
  const me = myEmail ? parseEmailAddress(myEmail) : "";
  const fromAddr = parseEmailAddress(email.from);
  const toAddrs = parseEmailList(email.to);
  const ccAddrs = parseEmailList(email.cc);
  const quoted = buildQuotedHtml(email);
  const threading = {
    inReplyTo: email.rfcMessageId || undefined,
    references: email.rfcMessageId || undefined,
    threadId: email.threadId || undefined,
  };

  if (mode === "reply") {
    return {
      mode,
      to: fromAddr,
      cc: "",
      subject: buildReplySubject(email.subject),
      bodyHtml: quoted,
      ...threading,
    };
  }

  if (mode === "replyAll") {
    const toSet = new Set<string>([fromAddr, ...toAddrs]);
    if (me) toSet.delete(me);
    const ccSet = new Set(ccAddrs);
    if (me) ccSet.delete(me);
    for (const addr of toSet) ccSet.delete(addr);
    return {
      mode,
      to: joinEmailList([...toSet]),
      cc: joinEmailList([...ccSet]),
      subject: buildReplySubject(email.subject),
      bodyHtml: quoted,
      ...threading,
    };
  }

  if (mode === "forward") {
    return {
      mode,
      to: "",
      cc: "",
      subject: buildForwardSubject(email.subject),
      bodyHtml: quoted,
    };
  }

  return { mode: "new", to: "", cc: "", subject: "", bodyHtml: "" };
}
