import { MenuItem } from '@affine/core/modules/app-sidebar/views';
import { ExternalMenuLinkItem } from '@affine/core/modules/app-sidebar/views/menu-item/external-menu-link-item';
import { useI18n } from '@affine/i18n';
import { ImportIcon, JournalIcon } from '@blocksuite/icons/rc';
import type { ReactElement, ReactNode } from 'react';

import {
  CollapsibleSection,
  NavigationPanelCollections,
  NavigationPanelFavorites,
  NavigationPanelMigrationFavorites,
  NavigationPanelOrganize,
  NavigationPanelTags,
} from '../../../desktop/components/navigation-panel';
import { InviteMembersButton } from '../invite-members-button';
import {
  CustomizeSectionsRow,
  useHiddenSections,
} from '../section-visibility-editor';
import { TemplateDocEntrance } from '../template-doc-entrance';
import { TrashButton } from '../trash-button';

interface HomeViewProps {
  onOpenImportModal: () => void;
  navigation?: ReactNode;
}

/**
 * Home tab — workspace navigation plus the current sidebar body
 * (Favorites / Organize / Tags / Collections / Others). Extracted into its
 * own component so it can be swapped in/out of the `SidebarScrollableContainer`
 * when the tab strip changes the active tab.
 *
 * Each section is wrapped in a hidden-set check so the Customize
 * Sections popover can hide it without unmounting peers. The check is
 * O(1) (Set.has) so this stays cheap on re-renders.
 */
export function HomeView({
  onOpenImportModal,
  navigation,
}: HomeViewProps): ReactElement {
  const t = useI18n();
  const { hidden } = useHiddenSections();

  return (
    <>
      <CustomizeSectionsRow />
      {navigation}
      {!hidden.has('favorites') && <NavigationPanelFavorites />}
      {!hidden.has('organize') && <NavigationPanelOrganize />}
      {!hidden.has('migrationFavorites') && (
        <NavigationPanelMigrationFavorites />
      )}
      {!hidden.has('tags') && <NavigationPanelTags />}
      {!hidden.has('collections') && <NavigationPanelCollections />}
      {!hidden.has('others') && (
        <CollapsibleSection
          path={['others']}
          title={t['com.affine.rootAppSidebar.others']()}
          contentStyle={{ padding: '6px 8px 0 8px' }}
        >
          <TrashButton />
          <MenuItem
            data-testid="slider-bar-import-button"
            icon={<ImportIcon />}
            onClick={onOpenImportModal}
          >
            <span data-testid="import-modal-trigger">{t['Import']()}</span>
          </MenuItem>
          <InviteMembersButton />
          <TemplateDocEntrance />
          <ExternalMenuLinkItem
            href="https://affine.pro/blog?tag=Release+Note"
            icon={<JournalIcon />}
            label={t['com.affine.app-sidebar.learn-more']()}
          />
        </CollapsibleSection>
      )}
    </>
  );
}
