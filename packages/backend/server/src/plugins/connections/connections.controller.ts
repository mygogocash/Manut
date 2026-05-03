import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Query,
  Redirect,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthenticationRequired, URLHelper, UseNamedGuard } from '../../base';
import { CurrentUser, Public } from '../../core/auth';
import { ConnectionsService } from './connections.service';

@Controller('/api/connections')
export class ConnectionsController {
  private readonly logger = new Logger(ConnectionsController.name);

  constructor(
    private readonly connections: ConnectionsService,
    private readonly url: URLHelper
  ) {}

  /**
   * Start OAuth flow for a provider.
   * GET /api/connections/oauth/:provider/start?workspaceId=X
   */
  @Get('/oauth/:provider/start')
  @UseNamedGuard('version')
  async startOAuth(
    @Req() req: Request,
    @Res() res: Response,
    @Query('workspaceId') workspaceId?: string,
    @Query('provider') provider?: string
  ) {
    // Extract provider from route param via req.params
    const providerName = (req.params as Record<string, string>)['provider'] ?? provider;

    if (!providerName) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'provider is required' });
    }
    if (!workspaceId) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'workspaceId is required' });
    }

    const user = (req as Request & { user?: CurrentUser }).user;
    if (!user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
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
      this.logger.error(`Failed to initiate OAuth for ${providerName}: ${err}`);
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: err instanceof Error ? err.message : 'Failed to initiate OAuth',
      });
    }
  }

  /**
   * OAuth callback from provider.
   * GET /api/connections/oauth/:provider/callback?code=X&state=Y
   */
  @Public()
  @Get('/oauth/:provider/callback')
  async oauthCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string
  ) {
    if (!code) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'code is required' });
    }
    if (!state) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'state is required' });
    }

    try {
      const { provider, displayName } = await this.connections.handleCallback(
        code,
        state
      );
      // Redirect to the frontend connections settings page with success indicator
      return this.url.safeRedirect(
        res,
        `/settings?tab=connections&connected=${provider}&name=${encodeURIComponent(displayName)}`
      );
    } catch (err) {
      this.logger.error(`OAuth callback failed: ${err}`);
      return this.url.safeRedirect(
        res,
        `/settings?tab=connections&error=${encodeURIComponent(
          err instanceof Error ? err.message : 'OAuth failed'
        )}`
      );
    }
  }
}
