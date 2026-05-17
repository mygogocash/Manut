import { DebugLogger } from '@affine/debug';
import mixpanel from 'mixpanel-browser';

import type { TrackProperties } from './state';
import { tracker } from './tracker';

const logger = new DebugLogger('mixpanel');

let initialized = false;

function getToken() {
  return BUILD_CONFIG.MIXPANEL_TOKEN?.trim() ?? '';
}

function toMixpanelProperties(props?: TrackProperties) {
  if (!props) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function isMixpanelEnabled() {
  return initialized && !!getToken();
}

export function initMixpanel() {
  const token = getToken();
  if (!token) {
    return;
  }
  if (initialized) {
    return;
  }

  mixpanel.init(token, {
    track_pageview: false,
    persistence: 'localStorage',
    ignore_dnt: false,
  });
  initialized = true;
  logger.info('Mixpanel initialized');
}

export function installMixpanelBridge() {
  const token = getToken();
  if (!token) {
    return () => {};
  }

  initMixpanel();

  return tracker.middleware((eventName, properties) => {
    if (!tracker.has_opted_in_tracking()) {
      return properties;
    }
    try {
      mixpanel.track(eventName, toMixpanelProperties(properties));
    } catch (error) {
      logger.error(`failed to track ${eventName}`, error);
    }
    return properties;
  });
}

export function mixpanelIdentify(userId: string) {
  if (!isMixpanelEnabled()) {
    return;
  }
  mixpanel.identify(userId);
}

export function mixpanelPeopleSet(properties: Record<string, unknown>) {
  if (!isMixpanelEnabled()) {
    return;
  }
  mixpanel.people.set(properties);
}

export function mixpanelReset() {
  if (!isMixpanelEnabled()) {
    return;
  }
  mixpanel.reset();
}

export function mixpanelOptIn() {
  if (!isMixpanelEnabled()) {
    return;
  }
  mixpanel.opt_in_tracking();
}

export function mixpanelOptOut() {
  if (!isMixpanelEnabled()) {
    return;
  }
  mixpanel.opt_out_tracking();
}
