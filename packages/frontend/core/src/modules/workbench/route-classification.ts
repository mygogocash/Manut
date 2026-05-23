import { matchPath, type RouteObject } from 'react-router-dom';

const DOC_ROUTE_PATH = '/:pageId';
const DOC_ROUTE_PREFIX = `${DOC_ROUTE_PATH}/`;

function normalizeWorkbenchPath(pathname: string) {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function isReservedWorkbenchRoute(path: string | undefined) {
  return (
    !path ||
    path === '*' ||
    path === DOC_ROUTE_PATH ||
    path.startsWith(DOC_ROUTE_PREFIX)
  );
}

export function isWorkbenchDocRoutePath(
  routes: readonly RouteObject[],
  pathname: string
) {
  const normalizedPath = normalizeWorkbenchPath(pathname);
  const reservedMatch = routes.some(route => {
    const path = route.path;
    if (isReservedWorkbenchRoute(path)) return false;
    return !!matchPath({ path, end: true }, normalizedPath);
  });

  if (reservedMatch) return false;

  return !!matchPath({ path: DOC_ROUTE_PATH, end: true }, normalizedPath);
}
