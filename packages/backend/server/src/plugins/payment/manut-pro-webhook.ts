import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

import { OnEvent } from '../../base';
import { Models } from '../../models';
import {
  MANUT_PRO_UPGRADE_FLAG,
  MANUT_PRO_UPGRADE_METADATA_KEY,
  MANUT_PRO_WORKSPACE_METADATA_KEY,
} from './manut-pro-config';

/**
 * Manut Pro tier (E3.3 / M3) — Stripe webhook handler.
 *
 * Listens on AFFiNE's existing stripe event bus (`stripe.${type}` events
 * relayed by `StripeWebhookController` after signature validation
 * against `payment.stripe.webhookKey`) and reacts ONLY to events
 * tagged with the Manut Pro metadata bundle:
 *
 *   metadata.manutProUpgrade === 'true'
 *   metadata.workspaceId === <uuid>
 *
 * Events without both keys are ignored — that keeps this handler
 * cleanly isolated from AFFiNE's existing `StripeWebhook` (`./webhook.ts`),
 * which only reacts to invoice / subscription events tied to the
 * AFFiNE Cloud subscription managers.
 *
 * Two transitions are handled:
 *
 *   - `checkout.session.completed` → flips `workspace.plan` to `'pro'`
 *   - `customer.subscription.deleted` → flips `workspace.plan` to `'free'`
 *
 * Subscription expiry / renewal failure: not handled here. The Free
 * tier downgrade only happens on explicit cancellation. A future R1
 * can layer `customer.subscription.updated` (status → `past_due` /
 * `unpaid`) and a grace-period flow if churn is high enough to need it.
 */
@Injectable()
export class ManutProWebhook {
  private readonly logger = new Logger(ManutProWebhook.name);

  constructor(private readonly models: Models) {}

  /**
   * Type guard for the metadata bundle we set in
   * `ManutProCheckoutResolver`. Both keys must be present for the
   * handler to react — this is the load-bearing isolation seam.
   */
  private extractWorkspaceId(
    metadata: Stripe.Metadata | null | undefined
  ): string | null {
    if (!metadata) return null;
    if (metadata[MANUT_PRO_UPGRADE_METADATA_KEY] !== MANUT_PRO_UPGRADE_FLAG) {
      return null;
    }
    const workspaceId = metadata[MANUT_PRO_WORKSPACE_METADATA_KEY];
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      return null;
    }
    return workspaceId;
  }

  @OnEvent('stripe.checkout.session.completed')
  async onCheckoutCompleted(
    event: Stripe.CheckoutSessionCompletedEvent
  ): Promise<void> {
    const session = event.data.object;
    const workspaceId = this.extractWorkspaceId(session.metadata);

    if (!workspaceId) {
      // Not a Manut Pro session — leave it for AFFiNE's existing
      // handlers (or no-op if no other handler cares).
      return;
    }

    // payment_status === 'unpaid' means the session completed but the
    // payment intent is still pending (e.g. delayed bank debit). We
    // wait for `invoice.paid` semantics in that case — for now, treat
    // 'paid' and 'no_payment_required' as the upgrade triggers.
    if (
      session.payment_status !== 'paid' &&
      session.payment_status !== 'no_payment_required'
    ) {
      this.logger.warn(
        `Manut Pro checkout completed for ${workspaceId} but payment_status=` +
          `${session.payment_status}. Skipping plan flip until paid.`
      );
      return;
    }

    try {
      await this.models.workspace.update(workspaceId, {
        plan: 'pro',
      });
      this.logger.log(
        `Upgraded workspace ${workspaceId} → 'pro' (session ${session.id}).`
      );
    } catch (err: unknown) {
      // Swallowing this would lose the upgrade silently — log so an
      // operator can reconcile manually. The webhook controller will
      // not retry on its own, but Stripe will replay the event up to
      // 3 days when the endpoint returns non-2xx — we let the
      // wrapping `setImmediate(() => emit().catch(...))` in
      // `StripeWebhookController` swallow it for now.
      this.logger.error(`Failed to mark workspace ${workspaceId} as Pro`, err);
      throw err;
    }
  }

  @OnEvent('stripe.customer.subscription.deleted')
  async onSubscriptionDeleted(
    event: Stripe.CustomerSubscriptionDeletedEvent
  ): Promise<void> {
    const subscription = event.data.object;
    const workspaceId = this.extractWorkspaceId(subscription.metadata);

    if (!workspaceId) {
      return;
    }

    try {
      await this.models.workspace.update(workspaceId, {
        plan: 'free',
      });
      this.logger.log(
        `Downgraded workspace ${workspaceId} → 'free' (subscription ` +
          `${subscription.id} deleted).`
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to downgrade workspace ${workspaceId} to Free`,
        err
      );
      throw err;
    }
  }
}
