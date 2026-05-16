import { ConnectionsSettingPanel } from '@affine/core/modules/connections';
import { IntegrationTypeIcon } from '@affine/core/modules/integration';
import type { I18nString } from '@affine/i18n';
import { Logo1Icon, TodayIcon } from '@blocksuite/icons/rc';
import type { ReactNode } from 'react';

import { CalendarSettingPanel } from './calendar/setting-panel';
import { GmailLogoIcon, GoogleDriveLogoIcon } from './google/icons';
import {
  GmailSettingPanel,
  GoogleDriveSettingPanel,
} from './google/setting-panel';
import {
  MnHandoverIcon,
  MnHandoverSettingPanel,
} from './manut-handover/setting-panel';
import MCPIcon from './mcp-server/MCP.inline.svg';
import { McpServerSettingPanel } from './mcp-server/setting-panel';
import { ReadwiseSettingPanel } from './readwise/setting-panel';

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
