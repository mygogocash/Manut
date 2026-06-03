/**
 * Manut M3 E3.5 — Typed flat-name telemetry events (Mixpanel-bound).
 *
 * The existing `@affine/track` package exposes a 4-level
 * `track.<page>.<segment>.<module>.<event>(args)` API constrained by the
 * union in `events.ts`. Manut's M3 §B13 spec asks for flat event names
 * (`ai_message_sent`, `floating_chat_opened`, ...) with typed property
 * payloads, so this module wraps the lower-level `tracker.track(name,
 * props)` entrypoint with a strongly-typed surface.
 *
 * Token gating: `tracker.track` already routes through the Mixpanel
 * middleware installed in `bootstrap/telemetry.ts` via
 * `installMixpanelBridge()`. When `BUILD_CONFIG.MIXPANEL_TOKEN` is
 * absent the bridge becomes a no-op (see
 * `packages/frontend/track/src/mixpanel.ts:isMixpanelEnabled`). The
 * GA-style telemetry transport still receives the event for internal
 * use, which is the desired behaviour — we want telemetry-without-
 * Mixpanel to keep working.
 *
 * Why a separate module rather than extending `@affine/track`'s typed
 * events tree:
 *   - The 4-level chain assumes the events fit into the upstream
 *     navigation taxonomy. M3 events (`ai_message_sent`,
 *     `memory_pinned`, ...) don't map cleanly to page/segment/module.
 *   - Flat names also match the spec verbatim, so downstream analytics
 *     dashboards in Mixpanel use the same event keys without an
 *     intermediate renaming step.
 *   - Coexistence with the chain API is intentional: this is the
 *     "Manut-shaped" surface; the upstream `track.*` chain stays
 *     untouched for upstream-defined events.
 */

import { tracker } from '@affine/track';

export interface TelemetryEvents {
  ai_message_sent: {
    model: string;
    mode: 'read' | 'edit' | 'agent';
    toolsEnabled: number;
    hasMemoryHit: boolean;
  };
  ai_tool_invoked: {
    toolName: string;
    success: boolean;
  };
  ai_agent_completion_event: {
    action:
      | 'approval_created'
      | 'approval_resolved'
      | 'doc_saved'
      | 'edit_applied'
      | 'retry_after_failure'
      | 'source_opened'
      | 'task_linked'
      | 'work_product_created';
    surface: 'chat' | 'task_cockpit';
    mode: 'agent' | 'edit' | 'read' | 'unknown';
    toolName?: string;
    status?: string;
  };
  floating_chat_opened: {
    from: 'shortcut' | 'button' | 'deeplink';
  };
  sidebar_nav_clicked: {
    tab: string;
    item: string;
  };
  memory_pinned: {
    kind: string;
  };
  memory_forgot: {
    kind: string;
  };
  quick_action_used: {
    action: string;
    docType: string;
  };
  connection_added: {
    provider: 'gmail' | 'calendar' | 'github';
  };
}

/**
 * Fire a Mixpanel-bound telemetry event.
 *
 * No-ops silently when telemetry is disabled (user opt-out) or when
 * MIXPANEL_TOKEN is unset — `tracker.track` checks `trackerState.enabled`
 * first, and the bridge middleware checks `isMixpanelEnabled()` before
 * forwarding. We don't gate ourselves here because the GA transport
 * still wants the event regardless of Mixpanel availability.
 *
 * Property keys are passed through verbatim. The Mixpanel bridge in
 * `@affine/track` strips `undefined` values, so optional props can be
 * conditionally spread without polluting the dashboard.
 */
export function trackEvent<K extends keyof TelemetryEvents>(
  event: K,
  props: TelemetryEvents[K]
): void {
  tracker.track(event, props);
}
