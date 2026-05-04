import { Injectable, Logger } from '@nestjs/common';

import { DocWriter } from '../../core/doc';
import { AccessController } from '../../core/permission';
import { GoogleOAuthService } from './google-oauth.service';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Maximum size of the request fan-out when hydrating message metadata.
 * Gmail's `messages.list` returns IDs only; each message's headers are a
 * separate `messages.get?format=metadata` call. Doing them serially makes
 * a 25-result list take 25× the latency, so we batch with bounded
 * concurrency. Five parallel requests stays well under Gmail's per-user
 * rate limit and matches what the Gmail web UI does.
 */
const HYDRATE_CONCURRENCY = 5;

export interface GmailMessageSummary {
  messageId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
}

/**
 * Live Gmail integration for v1.10.2. Two operations:
 *  - `listMessages`: search + metadata hydration → list view in the
 *    "Import emails as docs" dialog
 *  - `importMessage`: fetch full body, decode multipart MIME, sanitize,
 *    and persist as a new AFFiNE doc.
 *
 * Token refresh + the not-configured / not-connected error model lives in
 * {@link GoogleOAuthService.getValidAccessToken} — this service treats
 * those errors as opaque and lets them propagate to the resolver.
 */
@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly ac: AccessController,
    private readonly docWriter: DocWriter
  ) {}

  async listMessages(
    userId: string,
    workspaceId: string,
    query: string | undefined,
    maxResults: number
  ): Promise<GmailMessageSummary[]> {
    const accessToken = await this.oauth.getValidAccessToken(
      userId,
      workspaceId,
      'gmail'
    );

    const params = new URLSearchParams({
      maxResults: String(Math.max(1, Math.min(maxResults, 100))),
    });
    if (query && query.trim()) {
      params.set('q', query.trim());
    }

    const list = await this.gmailRequest<GmailListResponse>(
      accessToken,
      `/messages?${params.toString()}`
    );

    if (!list.messages || list.messages.length === 0) {
      return [];
    }

    const summaries = await this.hydrateMessages(
      accessToken,
      list.messages.map(m => m.id)
    );

    // Sort by parsed date desc, falling back to insertion order on
    // unparseable dates (Gmail occasionally returns RFC-2822 dates with
    // odd timezones — we don't want one bad row to drop the whole list).
    return summaries.slice().sort((a, b) => {
      const ta = Date.parse(a.date);
      const tb = Date.parse(b.date);
      const va = isNaN(ta) ? 0 : ta;
      const vb = isNaN(tb) ? 0 : tb;
      return vb - va;
    });
  }

  /**
   * Imports a Gmail message as a new AFFiNE doc. Returns the new doc ID.
   * The doc body is the email content (HTML stripped to plaintext when
   * we can't safely render it).
   */
  async importMessage(
    userId: string,
    workspaceId: string,
    messageId: string
  ): Promise<{ docId: string; subject: string }> {
    // Permission gate first — `getValidAccessToken` would also throw on
    // an invalid workspace/user combo, but we want a 403 before we hit
    // the Google API.
    await this.ac
      .user(userId)
      .workspace(workspaceId)
      .assert('Workspace.CreateDoc');

    const accessToken = await this.oauth.getValidAccessToken(
      userId,
      workspaceId,
      'gmail'
    );

    const message = await this.gmailRequest<GmailMessageResponse>(
      accessToken,
      `/messages/${encodeURIComponent(messageId)}?format=full`
    );

    const headers = readHeaders(message.payload?.headers ?? []);
    const subject = headers.subject?.trim() || 'Untitled email';
    const from = headers.from ?? '';
    const date = headers.date ?? '';

    const { content, contentType } = extractBody(message.payload);
    const bodyMarkdown =
      contentType === 'text/html'
        ? htmlToPlaintext(content)
        : content || '_(empty message body)_';

    const markdown = buildEmailMarkdown({
      from,
      date,
      body: bodyMarkdown,
    });

    const result = await this.docWriter.createDoc(
      workspaceId,
      subject,
      markdown,
      userId
    );

    this.logger.log(
      `Imported Gmail message ${messageId} as doc ${result.docId} in workspace ${workspaceId}`
    );

    return { docId: result.docId, subject };
  }

  private async hydrateMessages(
    accessToken: string,
    ids: string[]
  ): Promise<GmailMessageSummary[]> {
    const out: GmailMessageSummary[] = [];
    // Manual concurrency window — avoids pulling in a Promise pool dep.
    let cursor = 0;
    const fetchNext = async (): Promise<void> => {
      while (cursor < ids.length) {
        const idx = cursor++;
        const id = ids[idx];
        if (!id) continue;
        try {
          const msg = await this.gmailRequest<GmailMessageResponse>(
            accessToken,
            `/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
          );
          const headers = readHeaders(msg.payload?.headers ?? []);
          out.push({
            messageId: msg.id,
            from: headers.from ?? '',
            subject: headers.subject ?? '',
            date: headers.date ?? '',
            snippet: msg.snippet ?? '',
          });
        } catch (err) {
          // One bad row shouldn't drop the whole list — the user can
          // still import other messages. Log and continue.
          this.logger.warn(
            `Failed to hydrate Gmail message ${id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    };
    const workers = Array.from(
      { length: Math.min(HYDRATE_CONCURRENCY, ids.length) },
      fetchNext
    );
    await Promise.all(workers);
    return out;
  }

  private async gmailRequest<T>(accessToken: string, path: string): Promise<T> {
    const response = await fetch(`${GMAIL_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Gmail API ${response.status} on ${path}: ${text.slice(0, 200)}`
      );
    }
    return (await response.json()) as T;
  }
}

function readHeaders(headers: { name: string; value: string }[]): {
  from?: string;
  subject?: string;
  date?: string;
} {
  const out: { from?: string; subject?: string; date?: string } = {};
  for (const h of headers) {
    const k = h.name.toLowerCase();
    if (k === 'from') out.from = h.value;
    else if (k === 'subject') out.subject = h.value;
    else if (k === 'date') out.date = h.value;
  }
  return out;
}

/**
 * Walks a Gmail message payload (multipart MIME) and returns the best
 * available body. Preference order: text/plain → text/html → first part
 * with an inline body. Attachments are ignored.
 *
 * Body content is base64url-encoded — Gmail uses URL-safe base64 with
 * no padding, so we normalize before decoding.
 */
function extractBody(payload?: GmailMessagePart): {
  content: string;
  contentType: 'text/plain' | 'text/html' | 'unknown';
} {
  if (!payload) return { content: '', contentType: 'unknown' };

  const plain = findPart(payload, 'text/plain');
  if (plain?.body?.data) {
    return {
      content: decodeBase64Url(plain.body.data),
      contentType: 'text/plain',
    };
  }
  const html = findPart(payload, 'text/html');
  if (html?.body?.data) {
    return {
      content: decodeBase64Url(html.body.data),
      contentType: 'text/html',
    };
  }
  // Fallback: top-level body
  if (payload.body?.data) {
    return {
      content: decodeBase64Url(payload.body.data),
      contentType: 'unknown',
    };
  }
  return { content: '', contentType: 'unknown' };
}

function findPart(
  part: GmailMessagePart,
  mime: string
): GmailMessagePart | undefined {
  if (part.mimeType === mime) return part;
  if (part.parts) {
    for (const sub of part.parts) {
      const hit = findPart(sub, mime);
      if (hit) return hit;
    }
  }
  return undefined;
}

function decodeBase64Url(data: string): string {
  try {
    // Gmail returns URL-safe base64 without padding. Normalize before
    // letting Buffer parse it — `Buffer.from(..., 'base64')` accepts
    // URL-safe chars on Node 18+ but still rejects unpadded input on
    // some versions, so do it manually for safety.
    const padded = data
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(data.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Strip HTML to plaintext without pulling in `sanitize-html` or `turndown`.
 *
 * This is intentionally conservative — we want to be safe, not pretty:
 *  1. Remove script/style blocks entirely (their text content is not body)
 *  2. Replace block-level closes with newlines
 *  3. Strip remaining tags
 *  4. Decode the common HTML entities (full entity table is a separate dep)
 *  5. Collapse runs of whitespace
 *
 * Anything richer than this needs a real HTML parser, which is out of
 * scope for v1.10.2. Users who need the original HTML can still view
 * the email in Gmail.
 */
function htmlToPlaintext(html: string): string {
  if (!html) return '';
  let s = html;
  // 1. Drop script/style — their content is not part of the visible body.
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  // 2. Convert <br> and block closes to newlines BEFORE we strip tags.
  s = s.replace(/<br\s*\/?>(?!\n)/gi, '\n');
  s = s.replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n');
  // 3. Strip remaining tags. We're not preserving structure (lists, links,
  //    etc.) — just text — so a flat regex is acceptable here.
  s = s.replace(/<[^>]+>/g, '');
  // 4. Decode the entities most likely to appear in mail.
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, dec: string) =>
      String.fromCodePoint(Number(dec))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    );
  // 5. Collapse whitespace. Empty lines are kept (they break paragraphs)
  //    but trimmed of trailing space; runs of 3+ blank lines compress.
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/**
 * Compose the final markdown body. The resolver returns this to the
 * frontend already-rendered into a doc; the user can re-edit afterward.
 */
function buildEmailMarkdown(input: {
  from: string;
  date: string;
  body: string;
}): string {
  const parts: string[] = [];
  if (input.from || input.date) {
    const meta = [input.from, input.date].filter(Boolean).join(' · ');
    parts.push(`*${meta}*`);
  }
  parts.push(input.body || '_(empty message body)_');
  return parts.join('\n\n');
}
