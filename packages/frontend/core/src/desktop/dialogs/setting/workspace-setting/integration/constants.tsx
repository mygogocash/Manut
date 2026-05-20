import { ConnectionsSettingPanel } from '@affine/core/modules/connections';
import { IntegrationTypeIcon } from '@affine/core/modules/integration';
import type { I18nString } from '@affine/i18n';
import { Logo1Icon, TodayIcon } from '@blocksuite/icons/rc';
import type { ReactNode } from 'react';

import { CalendarSettingPanel } from './calendar/setting-panel';
import { FigmaLogoIcon } from './figma/icons';
import { FigmaSettingPanel } from './figma/setting-panel';
import { GithubLogoIcon } from './github/icons';
import { GithubSettingPanel } from './github/setting-panel';
import { GmailLogoIcon, GoogleDriveLogoIcon } from './google/icons';
import {
  GmailSettingPanel,
  GoogleDriveSettingPanel,
} from './google/setting-panel';
import { LinearLogoIcon } from './linear/icons';
import { LinearSettingPanel } from './linear/setting-panel';
import {
  MnHandoverIcon,
  MnHandoverSettingPanel,
} from './manut-handover/setting-panel';
import MCPIcon from './mcp-server/MCP.inline.svg';
import { McpServerSettingPanel } from './mcp-server/setting-panel';
import { MongoDbLogoIcon } from './mongodb/icons';
import { MongoDbSettingPanel } from './mongodb/setting-panel';
import { PostHogLogoIcon } from './posthog/icons';
import { PostHogSettingPanel } from './posthog/setting-panel';
import { ReadwiseSettingPanel } from './readwise/setting-panel';
import { SlackLogoIcon } from './slack/icons';
import { SlackSettingPanel } from './slack/setting-panel';

type IntegrationCard = {
  id: string;
  name: I18nString;
  desc: I18nString;
  icon: ReactNode;
  /**
   * When true, the integration depends on a cloud workspace. On local
   * workspaces the card is still rendered but appears muted with a
   * "Cloud only" badge instead of being hidden — visibility of the
   * full set helps users understand what's available.
   */
  requiresCloud?: boolean;
} & (
  | {
      setting: ReactNode;
    }
  | {
      link: string;
    }
);

const INTEGRATION_LIST = [
  {
    id: 'readwise' as const,
    name: 'com.affine.integration.readwise.name',
    desc: 'com.affine.integration.readwise.desc',
    icon: <IntegrationTypeIcon type="readwise" />,
    setting: <ReadwiseSettingPanel />,
  },
  {
    id: 'calendar' as const,
    name: 'com.affine.integration.calendar.name',
    desc: 'com.affine.integration.calendar.desc',
    icon: <TodayIcon />,
    setting: <CalendarSettingPanel />,
    requiresCloud: true,
  },
  {
    id: 'mcp-server' as const,
    name: 'com.affine.integration.mcp-server.name',
    desc: 'com.affine.integration.mcp-server.desc',
    icon: <img src={MCPIcon} />,
    setting: <McpServerSettingPanel />,
    requiresCloud: true,
  },
  {
    id: 'manut-handover' as const,
    name: 'Manut Handover',
    desc: 'Import release handover JSON into a workspace doc.',
    icon: <MnHandoverIcon />,
    setting: <MnHandoverSettingPanel />,
    requiresCloud: true,
  },
  {
    id: 'web-clipper' as const,
    name: 'com.affine.integration.web-clipper.name',
    desc: 'com.affine.integration.web-clipper.desc',
    icon: <Logo1Icon />,
    link: 'https://chromewebstore.google.com/detail/affine-web-clipper/mpbbkmbdpleomiogkbkkpfoljjpahmoi',
  },
  {
    id: 'connections' as const,
    name: 'com.affine.integration.connections.name',
    desc: 'com.affine.integration.connections.desc',
    icon: <span style={{ fontSize: '20px' }}>🔗</span>,
    setting: <ConnectionsSettingPanel />,
    requiresCloud: true,
  },
  {
    id: 'gmail' as const,
    name: 'com.affine.integration.gmail.name',
    desc: 'com.affine.integration.gmail.description',
    icon: <GmailLogoIcon />,
    setting: <GmailSettingPanel />,
    requiresCloud: true,
  },
  {
    id: 'google-drive' as const,
    name: 'com.affine.integration.google-drive.name',
    desc: 'com.affine.integration.google-drive.description',
    icon: <GoogleDriveLogoIcon />,
    setting: <GoogleDriveSettingPanel />,
    requiresCloud: true,
  },
  {
    // M2 E2.1 — GitHub OAuth scaffold + AI-callable read tools.
    // Same "Connect" pattern as the Gmail / Drive cards above;
    // copy intentionally generic ("AI to search issues …") because
    // live import UX isn't shipped yet.
    id: 'github' as const,
    name: 'GitHub',
    desc: 'Connect your GitHub account to let AI search issues, PRs, and repositories on your behalf.',
    icon: <GithubLogoIcon />,
    setting: <GithubSettingPanel />,
    requiresCloud: true,
  },
  {
    // M2 — Slack OAuth scaffold (v1.13.x). Connect/disconnect plumbing
    // only; AI tools deferred to a follow-up release. Bot-scope grant
    // covers channels:read, chat:read, users:read.
    id: 'slack' as const,
    name: 'Slack',
    desc: 'Connect your Slack workspace to let AI search channels and read messages on your behalf.',
    icon: <SlackLogoIcon />,
    setting: <SlackSettingPanel />,
    requiresCloud: true,
  },
  {
    // M2 — Linear OAuth scaffold (v1.13.x). Connect/disconnect plumbing
    // only; AI tools deferred. Single `read` scope covers issues,
    // projects, teams, comments.
    id: 'linear' as const,
    name: 'Linear',
    desc: 'Connect your Linear account to let AI search issues, projects, and teams on your behalf.',
    icon: <LinearLogoIcon />,
    setting: <LinearSettingPanel />,
    requiresCloud: true,
  },
  {
    // M2 — Figma OAuth scaffold (v1.13.x). Connect/disconnect plumbing
    // only; AI tools deferred. Single `file_read` scope. NOTE: Figma
    // tokens expire in 90 days — when AI tools ship, the service's
    // getValidAccessToken must extend the refresh-window pattern.
    id: 'figma' as const,
    name: 'Figma',
    desc: 'Connect your Figma account to let AI search files and read frames on your behalf.',
    icon: <FigmaLogoIcon />,
    setting: <FigmaSettingPanel />,
    requiresCloud: true,
  },
  {
    // Wave 7+ — MongoDB connection scaffold. Direct-URI auth (NOT
    // OAuth) — workspace user provides a connection string, encrypted
    // at rest. Inline Test button runs `db.command({ ping: 1 })` against
    // the candidate URI before persistence. Driver is loaded lazily so
    // the integration card surfaces a friendly error rather than
    // crashing when the `mongodb` npm package isn't installed.
    id: 'mongodb' as const,
    name: 'MongoDB',
    desc: 'Connect a MongoDB cluster to query analytics from your own collections.',
    icon: <MongoDbLogoIcon />,
    setting: <MongoDbSettingPanel />,
    requiresCloud: true,
  },
  {
    // Wave 7+ — PostHog connection scaffold. API-key + host auth (NOT
    // OAuth). Default host `https://app.posthog.com`; self-hosted
    // deployments can override via `POSTHOG_DEFAULT_HOST`. Test button
    // hits `/api/projects/` before persistence.
    id: 'posthog' as const,
    name: 'PostHog',
    desc: 'Connect a PostHog project to read events, insights, and feature flag data.',
    icon: <PostHogLogoIcon />,
    setting: <PostHogSettingPanel />,
    requiresCloud: true,
  },
] satisfies (IntegrationCard | false)[];

type IntegrationId = Exclude<
  Extract<(typeof INTEGRATION_LIST)[number], {}>,
  false
>['id'];

export type IntegrationItem = Exclude<IntegrationCard, 'id'> & {
  id: IntegrationId;
};

/**
 * Returns the full integration list. Cards that need a cloud workspace
 * are still returned on local workspaces — they're rendered in a
 * muted "Cloud only" state by the card component instead of being
 * filtered out. Hiding them caused users to think the integrations
 * weren't available at all and bounce from the panel.
 */
export function getAllowedIntegrationList(_isCloudWorkspace: boolean) {
  return INTEGRATION_LIST.filter(item => Boolean(item)) as IntegrationItem[];
}
