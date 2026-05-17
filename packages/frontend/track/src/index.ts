import { enableAutoTrack, makeTracker } from './auto';
import { type EventArgs, type Events } from './events';
import {
  initMixpanel,
  installMixpanelBridge,
  isMixpanelEnabled,
  mixpanelIdentify,
  mixpanelOptIn,
  mixpanelOptOut,
  mixpanelPeopleSet,
  mixpanelReset,
} from './mixpanel';
import { sentry } from './sentry';
import {
  flushTelemetry,
  setTelemetryContext,
  setTelemetryTransport,
} from './telemetry';
import { tracker } from './tracker';
export const track = makeTracker((event, props) => {
  tracker.track(event, props);
});

export {
  enableAutoTrack,
  type EventArgs,
  type Events,
  flushTelemetry,
  initMixpanel,
  installMixpanelBridge,
  isMixpanelEnabled,
  mixpanelIdentify,
  mixpanelOptIn,
  mixpanelOptOut,
  mixpanelPeopleSet,
  mixpanelReset,
  sentry,
  setTelemetryContext,
  setTelemetryTransport,
  tracker,
};
export default track;
