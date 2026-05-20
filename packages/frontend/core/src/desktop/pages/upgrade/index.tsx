import { AffineOtherPageLayout } from '@affine/component/affine-other-page-layout';
import { WorkspacesService } from '@affine/core/modules/workspace';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAsyncCallback } from '../../../components/hooks/affine-async-hooks';
import { useMutation } from '../../../components/hooks/use-mutation';
import { createManutProCheckoutSessionMutation } from './graphql';
import * as styles from './styles.css';

/**
 * Manut Pro upgrade page (E3.3 / M3 — decision #19).
 *
 * Marketing surface rendered at `/upgrade`. Headline pulls users into
 * the Stripe checkout via `createManutProCheckoutSession`. On success,
 * the mutation returns the absolute Stripe URL and the page redirects
 * via `window.location.assign(checkoutUrl)`.
 *
 * Reachable from:
 *   - The "Upgrade to Pro" button on `StorageCapModal` + `AiBudgetModal`
 *     (committed in Wave 2 / Wave 6).
 *   - `?canceled=1` query param when Stripe redirects back from a
 *     canceled checkout — used only to render a softer message.
 *
 * Workspace selection
 * -------------------
 * The mutation needs a `workspaceId`. Source of truth (in priority):
 *   1. `?workspaceId=<uuid>` query param (when the modal navigates).
 *   2. The first workspace in the user's workspaces list.
 * If neither resolves, the page shows a friendly "open a workspace
 * first" message instead of throwing.
 *
 * Graceful Stripe-not-configured handling
 * ---------------------------------------
 * Per CLAUDE.md scar #2.5 (R0 / "graceful without STRIPE_SECRET_KEY"),
 * the backend resolver throws `FailedToCheckout` with a friendly
 * message when `payment.manutPro.priceId` is unset. The frontend
 * catches that and renders it in the error block — no toast, no
 * unhandled rejection.
 */
export const UpgradePage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveData(workspacesService.list.workspaces$);

  const targetWorkspaceId = useMemo(() => {
    const fromQuery = params.get('workspaceId');
    if (fromQuery && fromQuery.length > 0) {
      return fromQuery;
    }
    const firstWorkspace = workspaces[0];
    return firstWorkspace?.id ?? null;
  }, [params, workspaces]);

  const canceled = params.get('canceled') === '1';

  // Cast at the boundary — same pattern as `/welcome` (see
  // `desktop/pages/welcome/graphql.ts` header). The mutation isn't
  // in the codegen union yet because the resolver ships in this
  // release.
  const { trigger: triggerCheckout } = useMutation({
    mutation: createManutProCheckoutSessionMutation,
  } as unknown as Parameters<typeof useMutation>[0]);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpgrade = useAsyncCallback(async () => {
    if (!targetWorkspaceId) {
      setErrorMessage(
        'Open a workspace first, then come back here to upgrade.'
      );
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // Cast the response shape because the typegen for this op
      // hasn't run yet — see `./graphql.ts` rationale.
      const result = (await triggerCheckout({
        workspaceId: targetWorkspaceId,
      } as unknown as Parameters<typeof triggerCheckout>[0])) as unknown as {
        createManutProCheckoutSession?: string | null;
      };

      const checkoutUrl = result?.createManutProCheckoutSession;
      if (!checkoutUrl || typeof checkoutUrl !== 'string') {
        throw new Error('No checkout URL returned. Please try again.');
      }

      // Full page redirect — Stripe's hosted checkout owns the rest
      // of the flow, then bounces back to `payment.manutPro.successUrl`
      // (or `/upgrade-success` by default).
      window.location.assign(checkoutUrl);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not start checkout. Please try again in a moment.';
      setErrorMessage(message);
      setSubmitting(false);
    }
  }, [submitting, targetWorkspaceId, triggerCheckout]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <div className={styles.root}>
      <article className={styles.card} data-testid="upgrade-page">
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backLink}
            onClick={handleBack}
            aria-label="Go back"
          >
            ← Back
          </button>
          <p className={styles.eyebrow}>Manut Pro</p>
          <h1 className={styles.headline}>Upgrade to Manut Pro</h1>
          <p className={styles.subCopy}>
            Lift your storage cap to 100 GB and your monthly AI budget to $50.
            Same workspace, more headroom for the team.
          </p>
          <div className={styles.priceBlock}>
            <span className={styles.price}>$20</span>
            <span className={styles.priceUnit}>per user, per month</span>
          </div>
        </header>

        <FeatureCompareTable />

        {canceled ? (
          <p className={styles.footnote}>
            No charge — you can come back any time.
          </p>
        ) : null}

        {errorMessage ? (
          <p className={styles.errorText} role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className={styles.ctaRow}>
          <button
            type="button"
            className={styles.upgradeButton}
            onClick={handleUpgrade}
            disabled={submitting || !targetWorkspaceId}
            data-testid="upgrade-page-checkout-button"
          >
            {submitting ? 'Opening checkout…' : 'Upgrade to Pro'}
          </button>
          <p className={styles.footnote}>Cancel anytime.</p>
        </div>
      </article>
    </div>
  );
};

/**
 * Feature comparison table. Decoupled into its own component so the
 * marketing copy is easy to edit without touching the data-fetching
 * boilerplate in the page above.
 *
 * Source of truth for the numbers: `core/quota/tiers.ts` —
 * `FREE_TIER` (2 GB / $5 / unlimited members) and `PRO_TIER`
 * (100 GB / $50 / unlimited members).
 */
const COMPARE_ROWS: ReadonlyArray<{
  feature: string;
  free: string;
  pro: string;
  highlightPro?: boolean;
}> = [
  {
    feature: 'Workspace storage',
    free: '2 GB',
    pro: '100 GB',
    highlightPro: true,
  },
  {
    feature: 'Monthly AI budget',
    free: '$5',
    pro: '$50 (up to $200)',
    highlightPro: true,
  },
  {
    feature: 'Team members',
    free: 'Unlimited',
    pro: 'Unlimited',
  },
  {
    feature: 'AI tools (chat, edit, search)',
    free: 'Included',
    pro: 'Included',
  },
  {
    feature: 'Email + community support',
    free: 'Included',
    pro: 'Priority',
    highlightPro: true,
  },
];

const FeatureCompareTable = () => {
  return (
    <div
      className={styles.compareTable}
      role="table"
      aria-label="Compare Free vs Pro"
    >
      <div className={styles.compareRow} role="row">
        <div
          className={`${styles.compareCell} ${styles.compareHeader}`}
          role="columnheader"
        >
          Feature
        </div>
        <div
          className={`${styles.compareCell} ${styles.compareHeader}`}
          role="columnheader"
        >
          Free
        </div>
        <div
          className={`${styles.compareCell} ${styles.compareHeader}`}
          role="columnheader"
        >
          Pro
        </div>
      </div>
      {COMPARE_ROWS.map(row => {
        const proClass = row.highlightPro
          ? `${styles.compareCell} ${styles.compareCellHighlight}`
          : styles.compareCell;
        return (
          <div className={styles.compareRow} role="row" key={row.feature}>
            <div className={styles.compareCell} role="cell">
              {row.feature}
            </div>
            <div className={styles.compareCell} role="cell">
              {row.free}
            </div>
            <div className={proClass} role="cell">
              {row.pro}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const Component = () => {
  return (
    <AffineOtherPageLayout>
      <UpgradePage />
    </AffineOtherPageLayout>
  );
};
