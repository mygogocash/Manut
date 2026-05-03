import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { URLHelper, UseNamedGuard } from '../../base';
import { CurrentUser, Public } from '../../core/auth';
import { ConnectionsService } from './connections.service';

const POSTMESSAGE_TYPE = 'affine:connection-oauth-result';

@Controller('/api/connections')
export class ConnectionsController {
  private readonly logger = new Logger(ConnectionsController.name);

  constructor(
    private readonly connections: ConnectionsService,
    private readonly url: URLHelper
  ) {}

  /**
   * Start OAuth flow for a provider.
   *
   * GET /api/connections/oauth/:provider/start?workspaceId=X
   *
   * Auth: required. Routes default to auth-required via the global `AuthGuard`
   * (registered in `server.ts`). The `@CurrentUser()` parameter is non-optional
   * so a missing session fails at the framework boundary, not in this handler.
   */
  @Get('/oauth/:provider/start')
  @UseNamedGuard('version')
  async startOAuth(
    @Res() res: Response,
    @CurrentUser() user: CurrentUser,
    @Param('provider') providerName: string,
    @Query('workspaceId') workspaceId?: string
  ) {
    if (!workspaceId) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'workspaceId is required' });
    }

    const redirectUri = this.url.link(
      `/api/connections/oauth/${providerName}/callback`
    );

    try {
      const authUrl = await this.connections.initiateOAuth(
        user.id,
        workspaceId,
        providerName,
        redirectUri
      );
      return res.redirect(authUrl);
    } catch (err) {
      // Log the actual provider name server-side; return a generic message to
      // the client to avoid leaking which provider names are configured.
      this.logger.error(
        `Failed to initiate OAuth for ${providerName}`,
        err instanceof Error ? err.stack : String(err)
      );
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'Failed to initiate OAuth' });
    }
  }

  /**
   * OAuth callback from provider.
   *
   * GET /api/connections/oauth/:provider/callback?code=X&state=Y
   *
   * Public — the OAuth provider's user agent calls this with the code; the
   * stored state token authorizes the exchange.
   *
   * Returns an HTML page that postMessages the result to `window.opener` (if
   * the flow was started in a popup) and falls back to a same-origin redirect
   * to /settings otherwise. This keeps the popup pattern as a pure-frontend
   * concern — the backend doesn't need to know whether the start was in a
   * popup or a full page.
   */
  @Public()
  @Get('/oauth/:provider/callback')
  async oauthCallback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string
  ) {
    if (!code || !state) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send(this.renderResultPage({ ok: false, error: 'invalid_callback' }));
    }

    try {
      const { provider, displayName } = await this.connections.handleCallback(
        code,
        state
      );
      return res
        .status(HttpStatus.OK)
        .send(
          this.renderResultPage({
            ok: true,
            provider,
            displayName,
          })
        );
    } catch (err) {
      // Log the full error server-side for debugging; the user-visible page
      // gets a generic code so we don't echo provider tokens / codes that
      // upstream APIs sometimes embed in error responses.
      this.logger.error(
        'OAuth callback failed',
        err instanceof Error ? err.stack : String(err)
      );
      return res
        .status(HttpStatus.OK)
        .send(this.renderResultPage({ ok: false, error: 'oauth_failed' }));
    }
  }

  private renderResultPage(
    result:
      | { ok: true; provider: string; displayName: string }
      | { ok: false; error: string }
  ): string {
    // Build the redirect URL for the same-window fallback. safeRedirect's
    // allow-list logic is mirrored here by hard-coding the relative path.
    const fallbackQuery = result.ok
      ? `connected=${encodeURIComponent(result.provider)}&name=${encodeURIComponent(result.displayName)}`
      : `error=${encodeURIComponent(result.error)}`;
    const fallbackUrl = `/settings?tab=connections&${fallbackQuery}`;

    // JSON-stringify the payload server-side so the client can parse safely
    // without any inline string interpolation that could be DOM-injected.
    const payload = JSON.stringify({
      type: POSTMESSAGE_TYPE,
      ...result,
    });

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Connecting…</title>
  <meta name="referrer" content="strict-origin" />
  <style>
    body { font: 14px system-ui, sans-serif; padding: 24px; color: #333; }
  </style>
</head>
<body>
  <p>Finishing up…</p>
  <script>
  (function () {
    var payload = ${payload};
    var fallbackUrl = ${JSON.stringify(fallbackUrl)};
    try {
      if (window.opener && window.opener !== window) {
        // Restrict the message to the same origin the popup loaded from.
        window.opener.postMessage(payload, window.location.origin);
        window.close();
        return;
      }
    } catch (e) {
      // Fall through to redirect.
    }
    window.location.replace(fallbackUrl);
  })();
  </script>
</body>
</html>`;
  }
}
