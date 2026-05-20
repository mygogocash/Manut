import { ConfirmModal } from '@affine/component/ui/modal';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const CENTS_PER_DOLLAR = 100;

/**
 * Props for {@link AiBudgetModal}.
 *
 * The modal is purely presentational: parents control open/close state
 * and the upgrade trigger. `spentCents` / `capCents` come from the
 * structured `AI_BUDGET_CAP` error payload thrown by the backend (see
 * `AiBudgetService.assertWithinCap` and `core/quota/ai-budget.service.ts`
 * for the wire shape — same JSON-in-message envelope as the storage
 * cap modal precedent).
 *
 * `onUpgrade` is a notify-only hook (for telemetry, etc.). The modal
 * navigates to `/upgrade` itself via `react-router-dom`'s `useNavigate`.
 * Mirrors `StorageCapModal` exactly — same route, same param contract —
 * so both quota-cap upsells funnel into the same Pro tier marketing
 * page.
 */
export interface AiBudgetModalProps {
  open: boolean;
  spentCents: number;
  capCents: number;
  onClose: () => void;
  /**
   * Optional notify-only hook. Fired before the modal navigates to
   * `/upgrade`. Use for telemetry or parent-controlled state cleanup.
   */
  onUpgrade?: () => void;
  /**
   * Optional workspace ID to forward as a `?workspaceId=…` query
   * param on `/upgrade` so the Pro upgrade page can call the
   * checkout mutation against the right workspace.
   */
  workspaceId?: string;
}

/**
 * Formats USD cents as a dollar string with two decimal places.
 * Examples:
 *   formatUsd(500)  -> "5.00"
 *   formatUsd(450)  -> "4.50"
 *   formatUsd(5000) -> "50.00"
 */
function formatUsd(cents: number): string {
  const usd = cents / CENTS_PER_DOLLAR;
  return usd.toFixed(2);
}

/**
 * MANUT Wave 6 (E1.12 — T-1.12.1.a): AI budget upsell modal.
 *
 * Surfaces when a chat invocation is rejected because the workspace's
 * running monthly AI spend would exceed the Free tier's $5 cap.
 * Mirrors `StorageCapModal` exactly — same `ConfirmModal` primitive,
 * same prop pattern, same testId convention — so the two upgrade
 * paths converge on the same UX skeleton.
 *
 * The "Upgrade to Pro" button is a placeholder for now — the real
 * billing/checkout flow ships in E3.3 (Month 3, decision #19). Until
 * then, `onUpgrade` should surface a friendly "coming soon" toast or
 * scroll the user to the relevant Settings panel.
 *
 * Copy follows IMPLEMENTATION_PLAN §0.3: "You've spent $X.XX of your
 * $5.00 monthly AI budget."
 */
export function AiBudgetModal({
  open,
  spentCents,
  capCents,
  onClose,
  onUpgrade,
  workspaceId,
}: AiBudgetModalProps): React.ReactElement {
  const navigate = useNavigate();
  const description = useMemo(() => {
    const spentUsd = formatUsd(spentCents);
    const capUsd = formatUsd(capCents);
    return `You've spent $${spentUsd} of your $${capUsd} monthly AI budget.`;
  }, [spentCents, capCents]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose();
      }
    },
    [onClose]
  );

  const handleConfirm = useCallback(() => {
    // Notify the parent first so consumers can fire telemetry or
    // dismiss neighbouring state, THEN navigate to /upgrade. Wiring
    // landed in M3 E3.3 — the route renders the Pro tier marketing
    // page and opens Stripe checkout via the
    // `createManutProCheckoutSession` mutation.
    onUpgrade?.();
    const target = workspaceId
      ? `/upgrade?workspaceId=${encodeURIComponent(workspaceId)}`
      : '/upgrade';
    navigate(target);
  }, [navigate, onUpgrade, workspaceId]);

  return (
    <ConfirmModal
      open={open}
      onOpenChange={handleOpenChange}
      title="AI budget limit reached"
      description={description}
      confirmText="Upgrade to Pro"
      cancelText="Not now"
      onConfirm={handleConfirm}
      onCancel={onClose}
      confirmButtonOptions={{
        variant: 'primary',
        ['data-testid' as string]: 'ai-budget-upgrade-button',
      }}
      contentOptions={{
        ['data-testid' as string]: 'ai-budget-modal',
      }}
    />
  );
}
