/**
 * `gmail_search` — AI tool wrapping the Gmail users.messages.list +
 * users.messages.get APIs through the existing Google OAuth scaffold
 * (CLAUDE.md §6 v1.10.2 scar).
 *
 * Auth path:
 *   GoogleOAuthService.getValidAccessToken(userId, workspaceId, 'gmail')
 * Tokens auto-refresh inside the 5-minute leeway — the tool never
 * touches the IntegrationConnection table directly.
 *
 * Graceful degradation contract — every failure mode lands in a
 * `toolError`, never a thrown exception (would crash the chat stream):
 *  - OAuth client not configured     → "Gmail is not configured.  …"
 *  - User/workspace missing 'gmail'  → "Gmail not connected. Connect …"
 *  - Refresh-token rotation failed   → friendly "reconnect Gmail" copy
 *  - Gmail API 401 / 4xx / 5xx       → status + truncated body
 *  - Malformed/empty response shape  → toolError with parse hint
 *
 * Body extraction (`includeBody: true`):
 *   Walks the multipart MIME payload, prefers text/plain → text/html →
 *   first inline body. HTML is stripped to plaintext via the 5-step
 *   regex stripper documented in CLAUDE.md §6 v1.10.2 (no
 *   `sanitize-html` / `turndown` dep). Mirrors GmailService's
 *   extractBody/htmlToPlaintext so behavior stays consistent between
 *   the AI-callable surface and the existing import-as-doc flow.
 */

import { Logger } from '@nestjs/common';
import { z } from 'zod';

import {
  GoogleOAuthNotConfiguredError,
  GoogleOAuthNotConnectedError,
  GoogleOAuthRefreshFailedError,
  type GoogleOAuthService,
} from '../../google-oauth/google-oauth.service';
import { toolError } from './error';
import { defineTool } from './tool';
import type { CopilotChatOptions } from './types';

const logger = new Logger('GmailSearchTool');

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Bounded fan-out for messages.get hydration. Five matches the Gmail
// web UI behavior and stays comfortably under per-user rate limits.
const HYDRATE_CONCURRENCY = 5;

const GmailSearchInputSchema = z.object({
  query: z
    .string()
    .min(1, 'query is required')
    .describe(
      'Gmail search query. Supports the same operator syntax as the Gmail web UI ' +
        '(e.g. `from:alice@example.com newer_than:7d has:attachment`).'
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe('How many messages to return (max 25). Defaults to 5.'),
  includeBody: z
    .boolean()
    .optional()
    .describe(
      'When true, fetches and returns each message body (plain-text). ' +
        'Adds one extra Gmail API call per message — keep maxResults small.'
    ),
});

type GmailSearchInput = z.infer<typeof GmailSearchInputSchema>;

export interface GmailSearchHit {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  body?: string;
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
 * Bind the tool handler with its OAuth dependency at registration time.
 * Mirrors the `buildImageGenHandler` pattern in `image-gen.ts`: the
 * provider.ts switch resolves `GoogleOAuthService` via `moduleRef.get(...)`
 * and `.bind(null, options)`s the CopilotChatOptions into the handler so
 * the AI-facing input schema stays clean.
 */
export const buildGmailSearchHandler = (oauth: GoogleOAuthService) => {
  return async (
    options: CopilotChatOptions,
    input: GmailSearchInput
  ): Promise<{ messages: GmailSearchHit[] } | ReturnType<typeof toolError>> => {
    const userId = options?.user;
    const workspaceId = options?.workspace;

    if (!userId || !workspaceId) {
      return toolError(
        'Gmail Search Failed',
        'Gmail search requires a user + workspace context.'
      );
    }

    let accessToken: string;
    try {
      accessToken = await oauth.getValidAccessToken(
        userId,
        workspaceId,
        'gmail'
      );
    } catch (e: unknown) {
      if (e instanceof GoogleOAuthNotConfiguredError) {
        return toolError(
          'Gmail Search Failed',
          'Gmail is not configured. Ask your admin to set GOOGLE_OAUTH_CLIENT_ID.'
        );
      }
      if (e instanceof GoogleOAuthNotConnectedError) {
        return toolError(
          'Gmail Search Failed',
          'Gmail not connected. Connect it from Settings > Integrations.'
        );
      }
      if (e instanceof GoogleOAuthRefreshFailedError) {
        return toolError(
          'Gmail Search Failed',
          'Gmail credentials expired. Reconnect from Settings > Integrations.'
        );
      }
      const message = e instanceof Error ? e.message : 'Unexpected error';
      logger.warn(
        `gmail_search auth failed workspace=${workspaceId} user=${userId}: ${message}`
      );
      return toolError('Gmail Search Failed', message);
    }

    const maxResults = Math.min(Math.max(input.maxResults ?? 5, 1), 25);

    try {
      const params = new URLSearchParams({
        q: input.query.trim(),
        maxResults: String(maxResults),
      });

      const list = await gmailRequest<GmailListResponse>(
        accessToken,
        `/messages?${params.toString()}`,
        options?.signal
      );

      if (!list.messages || list.messages.length === 0) {
        return { messages: [] };
      }

      const messages = await hydrateMessages(
        accessToken,
        list.messages.map(m => m.id).filter(Boolean),
        Boolean(input.includeBody),
        options?.signal
      );

      logger.log(
        `gmail_search ok workspace=${workspaceId} user=${userId} ` +
          `query="${input.query.slice(0, 80)}" hits=${messages.length}`
      );

      return { messages };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unexpected error';
      logger.warn(
        `gmail_search failed workspace=${workspaceId} user=${userId}: ${message}`
      );
      return toolError('Gmail Search Failed', message);
    }
  };
};

async function hydrateMessages(
  accessToken: string,
  ids: string[],
  includeBody: boolean,
  signal?: AbortSignal
): Promise<GmailSearchHit[]> {
  const format = includeBody ? 'full' : 'metadata';
  const metadataHeaders = includeBody
    ? ''
    : '&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date';

  const out: GmailSearchHit[] = [];
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < ids.length) {
      const idx = cursor++;
      const id = ids[idx];
      if (!id) continue;
      try {
        const msg = await gmailRequest<GmailMessageResponse>(
          accessToken,
          `/messages/${encodeURIComponent(id)}?format=${format}${metadataHeaders}`,
          signal
        );

        const headers = readHeaders(msg.payload?.headers ?? []);
        const hit: GmailSearchHit = {
          id: msg.id,
          threadId: msg.threadId,
          subject: headers.subject ?? '',
          from: headers.from ?? '',
          snippet: msg.snippet ?? '',
          date: headers.date ?? '',
        };

        if (includeBody) {
          const { content, contentType } = extractBody(msg.payload);
          hit.body =
            contentType === 'text/html' ? htmlToPlaintext(content) : content;
        }

        out.push(hit);
      } catch (err) {
        // Single-row hydration failures shouldn't drop the whole list —
        // the user can still see the other matches. Log and continue.
        logger.warn(
          `gmail_search hydrate failed id=${id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(HYDRATE_CONCURRENCY, ids.length) },
    worker
  );
  await Promise.all(workers);

  // Stable order: parsed date desc, unparseable dates sink to the
  // bottom (mirrors GmailService.listMessages behavior).
  out.sort((a, b) => {
    const ta = Date.parse(a.date);
    const tb = Date.parse(b.date);
    const va = isNaN(ta) ? 0 : ta;
    const vb = isNaN(tb) ? 0 : tb;
    return vb - va;
  });

  return out;
}

async function gmailRequest<T>(
  accessToken: string,
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Gmail API ${response.status} on ${path}: ${text.slice(0, 200)}`
    );
  }
  return (await response.json()) as T;
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
 * 5-step HTML → plaintext stripper. Mirrors the one in
 * `gmail.service.ts` line-for-line (CLAUDE.md §6 v1.10.2 scar) so the
 * AI-callable surface and the import-as-doc flow agree on behavior.
 *  1. Drop script/style blocks
 *  2. Convert <br> and block closes to newlines
 *  3. Strip remaining tags
 *  4. Decode the common HTML entities
 *  5. Collapse whitespace
 */
function htmlToPlaintext(html: string): string {
  if (!html) return '';
  let s = html;
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<br\s*\/?>(?!\n)/gi, '\n');
  s = s.replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
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
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/**
 * Tool factory. The bound `handler` already has the chat session's
 * `user` + `workspace` baked in (via `.bind(null, options)` in
 * provider.ts), so the AI-facing input schema only takes search params.
 */
export const createGmailSearchTool = (
  handler: (input: GmailSearchInput) => Promise<unknown>
) => {
  return defineTool({
    description:
      "Search the user's Gmail inbox via the Gmail API. Supports the same query operators as " +
      'gmail.com (from:, to:, subject:, has:attachment, newer_than:7d, label:inbox, etc.). ' +
      'Returns up to 25 messages, each with subject + from + snippet + date. Set includeBody=true ' +
      'to also fetch each message body as plain text (slower — one extra API call per message).',
    inputSchema: GmailSearchInputSchema,
    execute: async input => {
      try {
        return await handler(input);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unexpected error';
        logger.error(`gmail_search tool execute failed: ${message}`);
        return toolError('Gmail Search Failed', message);
      }
    },
  });
};
