/**
 * Manut Pro tier (E3.3 / M3) — Stripe checkout config constants.
 *
 * The runtime config schema (`payment.manutPro`) is declared on the
 * existing `payment` interface in `./config.ts` so it lines up with
 * AFFiNE's other payment fields under one `defineModuleConfig('payment', …)`
 * registration (the helper expects ALL leaf keys for a module in a
 * single call). This file owns the metadata-key constants the
 * checkout resolver + webhook handler depend on:
 *
 *   1. AFFiNE's existing checkout flow keeps working unchanged.
 *   2. The Manut Pro mutation can fail gracefully (`FailedToCheckout`)
 *      when `priceId` isn't configured without poisoning the global
 *      Stripe enable flag.
 *   3. Future tier ladders (e.g. Team / Enterprise) plug onto the
 *      same namespace.
 *
 * Env mapping at the operator boundary:
 *   - `STRIPE_PRO_PRICE_ID` → `payment.manutPro.priceId`
 *   - `STRIPE_MANUT_PRO_WEBHOOK_SECRET` → `payment.manutPro.webhookSecret`
 *   - `STRIPE_PRO_SUCCESS_URL` → `payment.manutPro.successUrl`
 *   - `STRIPE_PRO_CANCEL_URL` → `payment.manutPro.cancelUrl`
 *
 * Operators configure these via `config.json` overrides on the VM
 * (the `Config` service picks up nested-object overrides on the same
 * path). When `priceId` is empty, `manut-pro-checkout.resolver.ts`
 * surfaces a `FailedToCheckout('Manut Pro checkout is not configured')`
 * so the frontend `/upgrade` page renders a friendly error instead of
 * a hard crash.
 */

/**
 * Branded marker used to tag Stripe Checkout Sessions originated by the
 * Manut Pro tier flow. The webhook handler checks
 * `session.metadata?.manutProUpgrade === MANUT_PRO_UPGRADE_FLAG` before
 * mutating `workspace.plan` so the handler is inert against AFFiNE's
 * existing checkout sessions (they don't set this metadata).
 */
export const MANUT_PRO_UPGRADE_FLAG = 'true' as const;

/** Stripe metadata key that pairs a checkout session with a workspace. */
export const MANUT_PRO_WORKSPACE_METADATA_KEY = 'workspaceId' as const;

/** Stripe metadata key that marks a session as a Manut Pro upgrade. */
export const MANUT_PRO_UPGRADE_METADATA_KEY = 'manutProUpgrade' as const;

/**
 * Tier price the frontend renders. Wave 2 decision #19 — $20/user/mo.
 * Lives here so the marketing copy on the `/upgrade` page and the
 * Stripe Price ID configured by operators stay tied to the same
 * intent. The backend doesn't use this — it's a documentation anchor
 * imported by the React page.
 */
export const MANUT_PRO_PRICE_LABEL = '$20/user/mo' as const;
