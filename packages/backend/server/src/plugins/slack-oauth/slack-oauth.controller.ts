import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../core/auth';
import { SlackOAuthService } from './slack-oauth.service';

const POSTMESSAGE_TYPE = 'affine:slack-oauth-result';

/**
 * Slack OAuth callback handler.
 *
 * Lives at `/oauth/slack/callback` (no `/api` prefix) — Slack's OAuth
 * v2 app config registers a fixed redirect URI and the existing
 * AFFiNE callback at `/api/oauth/callback` is reserved for the
 * sign-in flow. Mirrors `/oauth/github/callback` in shape.
 *
 * The frontend opens the consent URL in a popup; this handler
 * postMessages the result back to the opener and falls back to a
 * same-origin redirect to /workspace settings if there's no opener.
 *
 * Public — Slack's user agent posts here with the auth code; the
 * single-use state token in cache authorizes the exchange.
 */
@Controller('/oauth/slack')
export class SlackOAuthController {
  private readonly logger = new Logger(SlackOAuthController.name);

  constructor(private readonly slack: SlackOAuthService) {}

  @Public()
  @Get('/callback')
  async callback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string
  ) {
    if (error) {
      return res
        .status(HttpStatus.OK)
        .send(this.renderResultPage({ ok: false, error }));
    }

    if (!code || !state) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send(this.renderResultPage({ ok: false, error: 'invalid_callback' }));
    }

    try {
      const { teamName } = await this.slack.handleCallback(code, state);
      return res
        .status(HttpStatus.OK)
        .send(this.renderResultPage({ ok: true, teamName }));
    } catch (err) {
      this.logger.error(
        'Slack OAuth callback failed',
        err instanceof Error ? err.stack : String(err)
      );
      return res
        .status(HttpStatus.OK)
        .send(this.renderResultPage({ ok: false, error: 'oauth_failed' }));
    }
  }

  /**
   * Render a tiny HTML page that postMessages the OAuth outcome to
   * the opener (popup pattern) and falls back to a same-origin
   * redirect when there's no opener. Payload is JSON-stringified
   * server-side so the inline script never interpolates untrusted
   * strings into the DOM.
   */
  private renderResultPage(
    result: { ok: true; teamName: string } | { ok: false; error: string }
  ): string {
    const fallbackQuery = result.ok
      ? `connected=slack&team=${encodeURIComponent(result.teamName)}`
      : `error=${encodeURIComponent(result.error)}`;
    const fallbackUrl = `/?settings=integrations&${fallbackQuery}`;

    const payload = JSON.stringify({
      type: POSTMESSAGE_TYPE,
      ...result,
    });

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Connecting Slack…</title>
  <meta name="referrer" content="strict-origin" />
  <style>body{font:14px system-ui,sans-serif;padding:24px;color:#333}</style>
</head>
<body>
  <p>Finishing up…</p>
  <script>
  (function () {
    var payload = ${payload};
    var fallbackUrl = ${JSON.stringify(fallbackUrl)};
    try {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(payload, window.location.origin);
        window.close();
        return;
      }
    } catch (e) { /* fall through */ }
    window.location.replace(fallbackUrl);
  })();
  </script>
</body>
</html>`;
  }
}
