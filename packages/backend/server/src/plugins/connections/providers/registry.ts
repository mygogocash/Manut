import type { OAuthProvider } from './base.js';
import { AsanaProvider } from './asana.js';
import { FigmaProvider } from './figma.js';
import { GitHubProvider } from './github.js';
import { GoogleProvider } from './google.js';
import { HubspotProvider } from './hubspot.js';
import { JiraProvider } from './jira.js';
import { LinearProvider } from './linear.js';
import { OneDriveProvider } from './onedrive.js';
import { SlackProvider } from './slack.js';
import { ZoomProvider } from './zoom.js';

const ALL_PROVIDERS: OAuthProvider[] = [
  new GoogleProvider(),
  new JiraProvider(),
  new AsanaProvider(),
  new ZoomProvider(),
  new HubspotProvider(),
  new OneDriveProvider(),
  new GitHubProvider(),
  new SlackProvider(),
  new LinearProvider(),
  new FigmaProvider(),
];

export const providerRegistry = new Map<string, OAuthProvider>(
  ALL_PROVIDERS.map(p => [p.name, p])
);

export function getProvider(name: string): OAuthProvider | undefined {
  return providerRegistry.get(name);
}

export function listProviders() {
  return ALL_PROVIDERS.map(p => ({ name: p.name, displayName: p.displayName, scopes: p.scopes }));
}
