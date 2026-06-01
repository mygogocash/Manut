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

const LEGAL_ROUTE_PATHS = new Set([
  '/privacy',
  '/privacy-policy',
  '/legal/privacy',
  '/legal/terms',
  '/legal/data-deletion-instructions',
  '/terms',
  '/terms-of-service',
]);

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

export function manutLandingLegalPageFile(staticPath: string, reqPath: string) {
  const path = normalizePath(reqPath);
  if (!LEGAL_ROUTE_PATHS.has(path)) {
    return null;
  }
  const landingPath = manutLandingDir(staticPath);
  const candidates = [
    join(landingPath, path, 'index.html'),
    join(landingPath, `${path}.html`),
  ];
  return candidates.find(candidate => existsSync(candidate)) ?? null;
}

export function registerManutLegalRoutes(app: Application, staticPath: string) {
  app.get(Array.from(LEGAL_ROUTE_PATHS), (req, res, next) => {
    const candidate = manutLandingLegalPageFile(staticPath, req.path);
    if (candidate) {
      res.sendFile(candidate);
      return;
    }
    next();
  });
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
      const path = normalizePath(req.path);
      if (path === '/') {
        res.sendFile(join(landingPath, 'index.html'));
        return;
      }
      // Subdirectory route fallback: Next.js static export emits each route
      // as `<route>/index.html`. Express.static with redirect:false won't
      // resolve `/about-us` -> `/about-us/index.html` automatically, so try
      // it here. Only attempt for paths that look like routes (no file
      // extension), so missing `/styles.css` still 404s properly instead of
      // serving HTML.
      if (!/\.[a-zA-Z0-9]{1,8}$/.test(path)) {
        const candidate = join(landingPath, path, 'index.html');
        if (existsSync(candidate)) {
          res.sendFile(candidate);
          return;
        }
      }
      next();
    });
  });
}
