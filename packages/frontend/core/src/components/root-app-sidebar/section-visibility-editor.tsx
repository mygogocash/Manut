import { Button, Menu } from '@affine/component';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { useI18n } from '@affine/i18n';
import {
  ArrowDownSmallIcon,
  ArrowUpSmallIcon,
  EyePanelIcon,
  HidePanelIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import type { ReactElement, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import type { SidebarMenuItemKey } from './sidebar-menu-customization';
import {
  customizeTriggerButton,
  customizeTriggerRow,
  sectionEditorActions,
  sectionEditorEye,
  sectionEditorHeader,
  sectionEditorLabel,
  sectionEditorMoveButton,
  sectionEditorRoot,
  sectionEditorRow,
  sectionEditorTitle,
  sectionEditorToggleButton,
} from './tab-strip.css';
import { useSidebarMenuPreferences } from './use-sidebar-menu-preferences';

interface MenuDescriptor {
  key: SidebarMenuItemKey;
  label: string;
}

function getMenuDescriptors(
  t: ReturnType<typeof useI18n>,
  sidebarTabsV2Enabled: boolean
): MenuDescriptor[] {
  return [
    ...(sidebarTabsV2Enabled
      ? []
      : [
          { key: 'aiChat', label: t['com.affine.workspaceSubPath.chat']() },
          { key: 'quickSearchAndNewDoc', label: 'Search & new doc' },
          {
            key: 'notifications',
            label: t['com.affine.rootAppSidebar.notifications'](),
          },
        ]),
    { key: 'allDocs', label: t['com.affine.workspaceSubPath.all']() },
    { key: 'graph', label: 'Graph' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'projects', label: 'Projects' },
    { key: 'crm', label: 'CRM' },
    { key: 'reminders', label: 'Reminders' },
    { key: 'routines', label: 'Routines' },
    { key: 'releaseRuns', label: 'Release runs' },
    { key: 'journals', label: t['com.affine.journal.app-sidebar-title']() },
    { key: 'agents', label: 'Agents' },
    { key: 'favorites', label: t['com.affine.rootAppSidebar.favorites']() },
    { key: 'organize', label: t['com.affine.rootAppSidebar.organize']() },
    { key: 'migrationFavorites', label: 'Migration favorites' },
    { key: 'tags', label: 'Tags' },
    { key: 'collections', label: 'Collections' },
    {
      key: 'trash',
      label: t['com.affine.workspaceSubPath.trash'](),
    },
    { key: 'import', label: t['Import']() },
    { key: 'inviteMembers', label: t['Invite Members']() },
    { key: 'connectGithub', label: 'Connect GitHub' },
    { key: 'templates', label: t['Template']() },
    { key: 'learnMore', label: t['com.affine.app-sidebar.learn-more']() },
    ...(sidebarTabsV2Enabled
      ? [{ key: 'newDoc', label: t['New Page']() }]
      : []),
    { key: 'downloadApp', label: 'Download App' },
  ] as MenuDescriptor[];
}

interface SectionVisibilityEditorProps {
  children: ReactNode;
}

/**
 * Popover that lists every customizable sidebar item with an eye-toggle and
 * up/down controls.
 * Mounted via the shared `Menu` primitive so we get focus-trap, keyboard
 * navigation, and dismissal-on-outside-click for free. The "Done" button is
 * a courtesy affordance — every toggle persists immediately via GlobalState,
 * so closing the menu has the same effect.
 */
export function SectionVisibilityEditor({
  children,
}: SectionVisibilityEditorProps): ReactElement {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const featureFlagService = useService(FeatureFlagService);
  const sidebarTabsV2Enabled = useLiveData(
    featureFlagService.flags.sidebar_tabs_v2.$
  );
  const rawDescriptors = useMemo(
    () => getMenuDescriptors(t, sidebarTabsV2Enabled),
    [sidebarTabsV2Enabled, t]
  );
  const { preferences, hidden, toggle, move } = useSidebarMenuPreferences();
  const descriptors = useMemo(() => {
    const byKey = new Map(rawDescriptors.map(item => [item.key, item]));
    return preferences.order
      .map(key => byKey.get(key))
      .filter((item): item is MenuDescriptor => !!item);
  }, [preferences.order, rawDescriptors]);

  return (
    <Menu
      rootOptions={{
        open,
        onOpenChange: setOpen,
      }}
      contentOptions={{
        side: 'right',
        align: 'start',
      }}
      items={
        <div
          className={sectionEditorRoot}
          data-testid="sidebar-section-visibility-editor"
        >
          <div className={sectionEditorHeader}>
            <span className={sectionEditorTitle}>Sidebar menu</span>
          </div>
          {descriptors.map(({ key, label }, index) => {
            const isHidden = hidden.has(key);
            return (
              <div
                key={key}
                className={sectionEditorRow}
                data-testid={`sidebar-section-toggle-${key}`}
              >
                <button
                  type="button"
                  className={sectionEditorToggleButton}
                  aria-pressed={!isHidden}
                  onClick={() => toggle(key)}
                >
                  <span className={sectionEditorLabel}>{label}</span>
                  <span
                    className={sectionEditorEye}
                    data-hidden={isHidden ? 'true' : 'false'}
                    aria-label={isHidden ? 'Show menu item' : 'Hide menu item'}
                  >
                    {isHidden ? <HidePanelIcon /> : <EyePanelIcon />}
                  </span>
                </button>
                <span className={sectionEditorActions}>
                  <button
                    type="button"
                    className={sectionEditorMoveButton}
                    disabled={index === 0}
                    aria-label={`Move ${label} up`}
                    data-testid={`sidebar-section-move-up-${key}`}
                    onClick={() => move(key, 'up')}
                  >
                    <ArrowUpSmallIcon />
                  </button>
                  <button
                    type="button"
                    className={sectionEditorMoveButton}
                    disabled={index === descriptors.length - 1}
                    aria-label={`Move ${label} down`}
                    data-testid={`sidebar-section-move-down-${key}`}
                    onClick={() => move(key, 'down')}
                  >
                    <ArrowDownSmallIcon />
                  </button>
                </span>
              </div>
            );
          })}
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', padding: 8 }}
          >
            <Button
              variant="primary"
              size="default"
              onClick={() => setOpen(false)}
              data-testid="sidebar-section-visibility-done"
            >
              Done
            </Button>
          </div>
        </div>
      }
    >
      {children}
    </Menu>
  );
}

interface CustomizeSectionsRowProps {
  className?: string;
}

/**
 * Inline "Customize sections" row, rendered above the Home view's section
 * list. Clicking the trigger opens the visibility-editor popover.
 */
export function CustomizeSectionsRow({
  className,
}: CustomizeSectionsRowProps): ReactElement {
  return (
    <div className={className ?? customizeTriggerRow}>
      <span>Sidebar</span>
      <SectionVisibilityEditor>
        <button
          type="button"
          className={customizeTriggerButton}
          data-testid="sidebar-customize-sections-trigger"
        >
          Customize
        </button>
      </SectionVisibilityEditor>
    </div>
  );
}
