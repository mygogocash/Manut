import { Injectable, Logger } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

import { Config, FailedToCheckout, URLHelper } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import { Models } from '../../models';
import {
  MANUT_PRO_UPGRADE_FLAG,
  MANUT_PRO_UPGRADE_METADATA_KEY,
  MANUT_PRO_WORKSPACE_METADATA_KEY,
} from './manut-pro-config';
import { StripeFactory } from './stripe';

/**
 * Manut Pro tier (E3.3 / M3) — Stripe checkout mutation.
 *
 * Decision #19 (IMPLEMENTATION_PLAN §0.3): Pro tier is $20/user/mo with
 * 100 GB storage + $50 monthly AI budget. This resolver opens a Stripe
 * Checkout Session for a single workspace, tagged with the metadata the
 * webhook (`manut-pro-webhook.ts`) needs to flip `workspace.plan` to
 * `'pro'` on success.
 *
 * Isolation from AFFiNE's existing checkout surface
 * --------------------------------------------------
 * AFFiNE ships its own `SubscriptionResolver.checkout` (resolver.ts:50)
 * that targets a different tier ladder (AFFiNE Cloud Pro / Team /
 * Believer). That resolver is intentionally untouched — Manut Pro adds
 * a NEW mutation (`createManutProCheckoutSession`) backed by a NEW
 * config namespace (`payment.manutPro.*`) so the two flows do not
 * share price IDs, success URLs, or webhook handlers. The only shared
 * surface is the Stripe SDK singleton from `StripeFactory`.
 *
 * Graceful gating
 * ---------------
 * Per CLAUDE.md scar #6c ("graceful without STRIPE_SECRET_KEY"), the
 * mutation throws `FailedToCheckout` with a friendly message when the
 * Pro price ID is unset. The frontend `/upgrade` page is expected to
 * render the error toast and keep the rest of the UI alive — no
 * 500 / unhandled rejection.
 */
@Injectable()
@Resolver()
export class ManutProCheckoutResolver {
  private readonly logger = new Logger(ManutProCheckoutResolver.name);

  constructor(
    private readonly config: Config,
    private readonly stripeProvider: StripeFactory,
    private readonly ac: AccessController,
    private readonly models: Models,
    private readonly url: URLHelper
  ) {}

  @Mutation(() => String, {
    name: 'createManutProCheckoutSession',
    description:
      'Open a Stripe Checkout Session that upgrades the workspace to ' +
      'Manut Pro. Returns the absolute checkout URL — the frontend ' +
      'redirects via `window.location.assign(checkoutUrl)`. Requires ' +
      'Workspace.Settings.Update.',
  })
  async createManutProCheckoutSession(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string
  ): Promise<string> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');

    const proConfig = this.config.payment.manutPro;
    const priceId = proConfig?.priceId?.trim();

    // Surfacing this as a typed UserFriendlyError (HTTP 500 — see
    // BaseTypeToHttpStatusMap) keeps the frontend `/upgrade` page able
    // to render a "checkout is being set up" banner instead of a hard
    // crash. Operators see the missing-config message in the server
    // log so the misconfiguration is obvious.
    if (!priceId) {
      this.logger.warn(
        'Manut Pro checkout requested but payment.manutPro.priceId is unset.'
      );
      throw new FailedToCheckout(
        'Manut Pro checkout is not configured yet. Please contact support.'
      );
    }

    const stripe = this.stripeProvider.stripe;
    if (!stripe) {
      throw new FailedToCheckout(
        'Stripe SDK is not initialised. Set STRIPE_API_KEY to enable checkout.'
      );
    }

    const successUrl =
      proConfig?.successUrl?.trim() ||
      `${this.url.baseUrl}/upgrade-success?workspaceId=${encodeURIComponent(workspaceId)}`;
    const cancelUrl =
      proConfig?.cancelUrl?.trim() || `${this.url.baseUrl}/upgrade?canceled=1`;

    // Best-effort prefill — Stripe accepts customer_email as a hint and
    // doesn't 4xx on empty / unknown values. Skip silently if unset.
    const customerEmail = user.email?.trim();

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail || undefined,
        // Metadata is the load-bearing contract with `manut-pro-webhook.ts`.
        // The handler refuses to mutate `workspace.plan` unless BOTH keys
        // are present — this isolates Manut Pro sessions from AFFiNE's
        // existing checkout sessions on the same Stripe account.
        metadata: {
          [MANUT_PRO_UPGRADE_METADATA_KEY]: MANUT_PRO_UPGRADE_FLAG,
          [MANUT_PRO_WORKSPACE_METADATA_KEY]: workspaceId,
        },
        // Mirror metadata onto the resulting subscription so the
        // `customer.subscription.deleted` downgrade path can resolve
        // the workspace without an additional Stripe API round-trip.
        subscription_data: {
          metadata: {
            [MANUT_PRO_UPGRADE_METADATA_KEY]: MANUT_PRO_UPGRADE_FLAG,
            [MANUT_PRO_WORKSPACE_METADATA_KEY]: workspaceId,
          },
        },
      });

      if (!session.url) {
        throw new FailedToCheckout(
          'Stripe did not return a checkout URL. Please retry.'
        );
      }

      this.logger.log(
        `Created Manut Pro checkout session ${session.id} for workspace ${workspaceId}.`
      );

      // Tagging the workspace exists for audit only — confirm it
      // resolves so we surface a clean error before forcing the user
      // through a checkout that ultimately can't be applied.
      const workspace = await this.models.workspace.get(workspaceId);
      if (!workspace) {
        throw new FailedToCheckout('Workspace not found.');
      }

      return session.url;
    } catch (err: unknown) {
      if (err instanceof FailedToCheckout) {
        throw err;
      }
      const message =
        err instanceof Error ? err.message : 'Unknown Stripe error.';
      this.logger.error('Manut Pro checkout failed', err);
      throw new FailedToCheckout(message);
    }
  }
}
