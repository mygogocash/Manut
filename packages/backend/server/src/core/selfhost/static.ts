import { join } from 'node:path';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Application } from 'express';
import { static as serveStatic } from 'express';
import isMobile from 'is-mobile';

import { Config } from '../../base';
import {
  registerManutLandingRoutes,
  registerManutLegalRoutes,
} from '../static-files/manut-landing';
import { SetupMiddleware } from './setup';

const staticPathRegex = /^\/(_plugin|assets|imgs|js|plugins|static)\//;

function isMissingStaticAssetError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { code?: string; status?: number; statusCode?: number };

  return err.code === 'ENOENT' || err.status === 404 || err.statusCode === 404;
}

@Injectable()
export class StaticFilesResolver implements OnModuleInit {
  constructor(
    private readonly config: Config,
    private readonly adapterHost: HttpAdapterHost,
    private readonly check: SetupMiddleware
  ) {}

  onModuleInit() {
    // in command line mode
    if (!this.adapterHost.httpAdapter) {
      return;
    }

    const app = this.adapterHost.httpAdapter.getInstance<Application>();
    // for example, '/affine' in host [//host.com/affine]
    const basePath = this.config.server.path;
    const staticPath = join(env.projectRoot, 'static');

    // web => {
    //   affine: 'static/index.html',
    //   selfhost: 'static/selfhost.html'
    // }
    // admin => {
    //   affine: 'static/admin/index.html',
    //   selfhost: 'static/admin/selfhost.html'
    // }
    // mobile => {
    //   affine: 'static/mobile/index.html',
    //   selfhost: 'static/mobile/selfhost.html'
    // }
    // NOTE(@forehalo):
    //   the order following routes should be respected,
    //   otherwise the app won't work properly.

    // START REGION: /admin
    // do not allow '/index.html' url, redirect to '/'
    app.get(basePath + '/admin/index.html', (_req, res) => {
      return res.redirect(basePath + '/admin');
    });

    // serve all static files
    app.use(
      basePath + '/admin',
      serveStatic(join(staticPath, 'admin'), {
        redirect: false,
        index: false,
        fallthrough: true,
      })
    );

    // fallback all unknown routes
    app.get(
      [basePath + '/admin', basePath + '/admin/*path'],
      this.check.use,
      (_req, res) => {
        res.sendFile(
          join(
            staticPath,
            'admin',
            env.selfhosted ? 'selfhost.html' : 'index.html'
          )
        );
      }
    );
    // END REGION

    // START REGION: /mobile
    // serve all static files
    app.use(
      basePath,
      serveStatic(join(staticPath, 'mobile'), {
        redirect: false,
        index: false,
        fallthrough: true,
      })
    );
    // END REGION

    // START REGION: /
    // Marketing site at / when static/landing is present (manut.xyz).
    registerManutLegalRoutes(app, staticPath);
    registerManutLandingRoutes(app, basePath, staticPath);

    // do not allow '/index.html' url, redirect to '/'
    app.get(basePath + '/index.html', (_req, res) => {
      return res.redirect(basePath);
    });

    // Static asset URLs are content-addressed by the frontend bundle. If an
    // old client requests a removed hashed file after a deploy, return 404
    // instead of falling through to the SPA shell or marketing index.
    app.use(basePath || '/', (req, res, next) => {
      if (!staticPathRegex.test(req.path)) {
        next();
        return;
      }

      serveStatic(staticPath, {
        redirect: false,
        index: false,
        fallthrough: false,
        immutable: true,
        dotfiles: 'ignore',
      })(req, res, error => {
        if (isMissingStaticAssetError(error)) {
          res.status(404).end();
          return;
        }
        next(error);
      });
    });

    // serve all static files
    app.use(
      basePath,
      serveStatic(staticPath, {
        redirect: false,
        index: false,
        fallthrough: true,
        immutable: true,
        dotfiles: 'ignore',
      })
    );

    // fallback all unknown routes
    app.get([basePath, basePath + '/*path'], this.check.use, (req, res) => {
      // MANUT: also serve the mobile SPA shell on selfhosted. See the
      // matching change in doc-renderer/controller.ts. Without this,
      // mobile browsers got the desktop SPA shell which doesn't fit
      // phone viewports.
      const mobile =
        (env.namespaces.canary || env.selfhosted) &&
        isMobile({
          ua: req.headers['user-agent'] ?? undefined,
        });

      return res.sendFile(
        join(
          staticPath,
          mobile ? 'mobile' : '',
          env.selfhosted ? 'selfhost.html' : 'index.html'
        )
      );
    });
    // END REGION
  }
}
