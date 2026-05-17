import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { Application, Request } from 'express';
import { static as serveStatic } from 'express';

/** App routes that must keep the SPA shell, not the marketing site. */
const SPA_ROUTE_PREFIXES = [
  '/admin',
  '/api',
  '/graphql',
  '/socket.io',
  '/workspace',
  '/share',
  '/sign-in',
  '/sign-In',
  '/signIn',
  '/oauth',
  '/auth',
  '/magic-link',
  '/invite',
  '/onboarding',
  '/expired',
  '/404',
  '/upgrade',
  '/subscribe',
  '/try-cloud',
  '/redirect-proxy',
  '/theme-editor',
  '/clipper',
  '/template',
  '/open-app',
  '/desktop-signin',
  '/ai-upgrade',
] as const;

export function manutLandingDir(staticPath: string) {
  return join(staticPath, 'landing');
}

export function hasManutLanding(staticPath: string) {
  return existsSync(join(manutLandingDir(staticPath), 'index.html'));
}

function normalizePath(path: string) {
  if (!path || path === '/') {
    return '/';
  }
  return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
}

export function isManutSpaRoute(reqPath: string) {
  const path = normalizePath(reqPath);
  if (path === '/') {
    return false;
  }
  return SPA_ROUTE_PREFIXES.some(
    prefix => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function registerManutLandingRoutes(
  app: Application,
  basePath: string,
  staticPath: string
) {
  const landingPath = manutLandingDir(staticPath);
  if (!existsSync(join(landingPath, 'index.html'))) {
    return;
  }

  const root = basePath || '/';
  const landingAsset = serveStatic(landingPath, {
    redirect: false,
    index: false,
    fallthrough: true,
  });

  const shouldTryLanding = (req: Request) =>
    !isManutSpaRoute(normalizePath(req.path));

  app.use(root, (req, res, next) => {
    if (!shouldTryLanding(req)) {
      next();
      return;
    }
    landingAsset(req, res, err => {
      if (err) {
        next(err);
        return;
      }
      if (res.headersSent) {
        return;
      }
      if (normalizePath(req.path) === '/') {
        res.sendFile(join(landingPath, 'index.html'));
        return;
      }
      next();
    });
  });
}
