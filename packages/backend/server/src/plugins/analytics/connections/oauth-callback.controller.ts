import { Controller, Get, Logger, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../../core/auth';
import { ConnectionService } from './connection.service';

interface PendingAccountChoice {
  externalAccountId: string;
  externalAccountName: string;
}

type PostMessageType =
  | 'analytics:oauth:done'
  | 'analytics:oauth:error'
  | 'analytics:oauth:choose-account';

interface PostMessageBody {
  type: PostMessageType;
  message?: string;
  pendingId?: string;
  accounts?: PendingAccountChoice[];
}

const MAX_ACCOUNT_NAME_LEN = 100;
const MAX_ACCOUNT_ID_LEN = 100;
const MAX_ACCOUNTS_TO_SHOW = 50;
const ASCII_PRINTABLE = /[^\x20-\x7e]/g;

/**
 * REST controller for the analytics OAuth callback. The provider redirects
 * the user's browser here with `?code=...&state=...`. We complete the flow
 * server-side and return a tiny HTML page that posts a message to the
 * opener window and closes itself — the connections settings page reads
 * that message and refreshes its list.
 *
 * The route is `/api/integrations/oauth/callback/:platform`. The `:platform`
 * segment is informational only — the actual platform is encoded in the
 * signed `state` token. We accept any value so we can register a single
 * redirect URI per provider and route them all through this one handler.
 */
@Controller('/api/integrations/oauth/callback')
export class OAuthCallbackController {
  private readonly logger = new Logger(OAuthCallbackController.name);

  constructor(private readonly connections: ConnectionService) {}

  @Public()
  @Get(':platform')
  async callback(
    @Param('platform') platform: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') errorCode: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    void platform;

    if (errorCode) {
      const message = errorDescription ?? errorCode;
      this.logger.warn(
        `OAuth callback received provider error: ${errorCode} ${
          errorDescription ?? ''
        }`
      );
      this.respondHtml(res, { type: 'analytics:oauth:error', message });
      return;
    }

    if (!code || !state) {
      this.respondHtml(res, {
        type: 'analytics:oauth:error',
        message: 'Missing code or state parameter',
      });
      return;
    }

    try {
      const result = await this.connections.completeOAuth(state, code);
      if (result.kind === 'completed') {
        this.respondHtml(res, { type: 'analytics:oauth:done' });
      } else {
        // Multi-account Meta — surface the picker payload to the opener.
        // Account names are user-controlled (Meta Page titles, IG usernames,
        // Threads display names). Apply the same printable-ASCII allowlist
        // we use elsewhere on this controller, drop empty entries, and cap
        // the list so a hostile Meta response can't blow up the inline
        // <script> JSON.
        const safeAccounts = result.accounts
          .map(a => ({
            externalAccountId: this.sanitize(a.id, MAX_ACCOUNT_ID_LEN),
            externalAccountName: this.sanitize(a.name, MAX_ACCOUNT_NAME_LEN),
          }))
          .filter(
            a =>
              a.externalAccountId.length > 0 && a.externalAccountName.length > 0
          )
          .slice(0, MAX_ACCOUNTS_TO_SHOW);
        if (safeAccounts.length === 0) {
          // All names failed sanitisation — degrade to a clear error rather
          // than opening a picker with no rows.
          this.respondHtml(res, {
            type: 'analytics:oauth:error',
            message: 'No selectable accounts returned',
          });
          return;
        }
        this.respondHtml(res, {
          type: 'analytics:oauth:choose-account',
          pendingId: this.sanitize(result.pendingId, MAX_ACCOUNT_ID_LEN),
          accounts: safeAccounts,
        });
      }
    } catch (err) {
      // Log the full stack server-side; do NOT propagate the raw exception
      // text to the popup HTML — that text is reinterpreted as content and
      // is provider/user-controlled in many code paths.
      this.logger.warn(
        `OAuth completion failed: ${
          err instanceof Error ? err.stack : String(err)
        }`
      );
      this.respondHtml(res, {
        type: 'analytics:oauth:error',
        message: 'OAuth completion failed',
      });
    }
  }

  /**
   * Strict printable-ASCII allowlist + length cap. Prevents injection via
   * unicode line terminators, RTL marks, BOMs, etc. Used on every string
   * that ends up in the inline <script> postMessage payload.
   */
  private sanitize(value: string | undefined, maxLen: number): string {
    if (typeof value !== 'string') return '';
    return value.replace(ASCII_PRINTABLE, '').slice(0, maxLen);
  }

  private respondHtml(res: Response, body: PostMessageBody): void {
    // Hard limit + character allowlist on the human-readable message.
    // Strict allowlist (printable ASCII + common punctuation) prevents
    // injection through unicode tricks (line/paragraph separators, BOMs,
    // RTL marks, etc).
    const safeMessage =
      typeof body.message === 'string'
        ? this.sanitize(body.message, 200)
        : undefined;

    const out: Record<string, unknown> = { type: body.type };
    if (safeMessage) out.message = safeMessage;
    if (typeof body.pendingId === 'string') {
      out.pendingId = body.pendingId; // already sanitised by caller
    }
    if (Array.isArray(body.accounts)) {
      out.accounts = body.accounts; // already sanitised + capped by caller
    }

    const payload = JSON.stringify(out);

    // JSON.stringify alone is NOT safe to embed in <script>: a `</script>`
    // inside the payload would terminate the script tag. Replace HTML and
    // line-terminator chars with JS unicode escapes — the result is still
    // valid JSON parsed identically by JSON.parse / postMessage, but cannot
    // break out of the script context.
    // Rewrite the LITERAL U+2028 / U+2029 codepoints to their 6-char
    // escape sequence form. These bytes are valid inside JSON strings
    // but ARE line terminators in JavaScript itself, so without escaping
    // they would close the inline <script> line and break parsing. The
    // `new RegExp` form is used so we never have to embed the literal
    // U+2028 / U+2029 codepoints in the source file (which would also
    // terminate this very line comment in any tool that honors U+2028).
    const safePayload = payload
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(new RegExp('\\u2028', 'g'), '\\u2028')
      .replace(new RegExp('\\u2029', 'g'), '\\u2029');

    const html = `<!doctype html><meta charset="utf-8"><title>OAuth complete</title><script>(function(){try{window.opener&&window.opener.postMessage(${safePayload},window.location.origin);}catch(e){}window.close();})();</script><p>You can close this window.</p>`;
    res.status(200).type('text/html').send(html);
  }
}
