/**
 * Manut-branded 404 page — "This page wandered off."
 *
 * Wave 2 B12 / M3 E3.4 brand polish. Replaces the upstream
 * `<NotFoundPage>` for the catch-all route (`*`) and `/404`. The
 * upstream `<NoPermissionOrNotFound>` flow (sign-in prompt for
 * unauthenticated visitors hitting a workspace they can't see) is
 * preserved by re-using the upstream component when `noPermission`
 * is true — that path has auth-server bouncing semantics we should
 * not reimplement.
 *
 * Suggested actions:
 *   1. "Go home" → `/workspace/{lastId}/all` (or `/` if no last id)
 *   2. "Open last doc" → uses `last_workspace_id` + `last_doc_id`
 *      from localStorage (best-effort; fades out the button if neither
 *      is set)
 *   3. "Search" → toggles the CMDK quick-search modal
 *
 * Mascot: inline SVG (no asset deps) — a soft violet+cream geometric
 * blob that gently floats. Cheap to ship and easy to retheme.
 */
import type { ReactElement } from 'react';
/**
 * The Manut-branded 404 body. Used both for the explicit `/404` route
 * and the catch-all `*` route — both come through this component via
 * `lazy: () => import('./pages/404')`.
 */
export declare const ManutPageNotFound: () => ReactElement;
/**
 * Authorised-but-can't-see-this surface goes through the upstream
 * `<NoPermissionOrNotFound>` flow — that path has sign-in popovers
 * + sign-out wiring we don't want to reimplement here. Brand-polish
 * only the public 404 surface.
 */
export declare const PageNotFound: ({ noPermission, }: {
    noPermission?: boolean;
}) => ReactElement;
export declare const Component: () => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=index.d.ts.map