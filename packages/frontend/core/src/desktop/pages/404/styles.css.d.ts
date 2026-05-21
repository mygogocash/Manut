/**
 * Manut-branded 404 — "This page wandered off."
 *
 * Wave 2 B12 / M3 E3.4 brand polish. Replaces the upstream
 * `<NotFoundPage>` for the catch-all route (`*`) AND `/404`.
 *
 * Token routing: this file is leaf-pure — we reference Manut CSS
 * vars by name rather than importing from `@affine/component`'s
 * package root, to dodge the vanilla-extract Node-VM scar that
 * surfaces when DOM-typed siblings leak into evaluation
 * (CLAUDE.md §6 "vanilla-extract evaluates `.css.ts` files in a
 * Node VM at build time").
 */
export declare const root: string;
export declare const card: string;
export declare const mascotWrapper: string;
export declare const headline: string;
export declare const subCopy: string;
export declare const actions: string;
export declare const actionButton: string;
export declare const primaryAction: string;
export declare const url: string;
//# sourceMappingURL=styles.css.d.ts.map