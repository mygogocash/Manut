import type { ReactElement, ReactNode } from 'react';
import { Fragment, useMemo } from 'react';

import {
  NavigationPanelCollections,
  NavigationPanelFavorites,
  NavigationPanelMigrationFavorites,
  NavigationPanelOrganize,
  NavigationPanelTags,
} from '../../../desktop/components/navigation-panel';
import { CustomizeSectionsRow } from '../section-visibility-editor';
import {
  getVisibleSidebarMenuItems,
  type SidebarMenuItem,
} from '../sidebar-menu-customization';
import { useSidebarMenuPreferences } from '../use-sidebar-menu-preferences';

interface HomeViewProps {
  onOpenImportModal: () => void;
  menuItems?: SidebarMenuItem<ReactNode>[];
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
  onOpenImportModal: _onOpenImportModal,
  menuItems = [],
}: HomeViewProps): ReactElement {
  const { preferences } = useSidebarMenuPreferences();
  const sectionItems = useMemo<SidebarMenuItem<ReactNode>[]>(
    () => [
      { key: 'favorites', value: <NavigationPanelFavorites /> },
      { key: 'organize', value: <NavigationPanelOrganize /> },
      {
        key: 'migrationFavorites',
        value: <NavigationPanelMigrationFavorites />,
      },
      { key: 'tags', value: <NavigationPanelTags /> },
      { key: 'collections', value: <NavigationPanelCollections /> },
    ],
    []
  );
  const visibleItems = getVisibleSidebarMenuItems(
    [...menuItems, ...sectionItems],
    preferences
  );

  return (
    <>
      <CustomizeSectionsRow />
      {visibleItems.map(({ key, value }) => (
        <Fragment key={key}>{value}</Fragment>
      ))}
    </>
  );
}
