import { Button, Menu } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { EyePanelIcon, HidePanelIcon } from '@blocksuite/icons/rc';
import { LiveData, useLiveData, useService } from '@toeverything/infra';
import type { ReactElement, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { GlobalStateService } from '../../modules/storage';
import { WorkspaceService } from '../../modules/workspace';
import {
  customizeTriggerButton,
  customizeTriggerRow,
  sectionEditorEye,
  sectionEditorHeader,
  sectionEditorLabel,
  sectionEditorRoot,
  sectionEditorRow,
  sectionEditorTitle,
} from './tab-strip.css';

// Stable identifiers for each section we expose to the visibility editor.
// Adding a section here is a two-step contract: (1) extend this union,
// (2) read the resulting hidden-set in `HomeView` and short-circuit the
// matching component render. The set is persisted to GlobalState under
// `sidebar.hiddenSections.${workspaceId}`.
export type SidebarSectionKey =
  | 'favorites'
  | 'organize'
  | 'migrationFavorites'
  | 'tags'
  | 'collections'
  | 'others';

export const SIDEBAR_SECTION_KEYS: readonly SidebarSectionKey[] = [
  'favorites',
  'organize',
  'migrationFavorites',
  'tags',
  'collections',
  'others',
];

interface SectionDescriptor {
  key: SidebarSectionKey;
  label: string;
}

function getSectionDescriptors(
  t: ReturnType<typeof useI18n>
): SectionDescriptor[] {
  return [
    { key: 'favorites', label: t['com.affine.rootAppSidebar.favorites']() },
    { key: 'organize', label: t['com.affine.rootAppSidebar.organize']() },
    { key: 'migrationFavorites', label: 'Migration favorites' },
    { key: 'tags', label: 'Tags' },
    { key: 'collections', label: 'Collections' },
    { key: 'others', label: t['com.affine.rootAppSidebar.others']() },
  ];
}

function storageKeyFor(workspaceId: string): string {
  return `sidebar.hiddenSections.${workspaceId}`;
}

/**
 * Reactive accessor for the per-workspace hidden-sections set. Stored as a
 * `string[]` in `GlobalState` (Set is not JSON-serialisable) and lifted
 * into a Set in memory for O(1) lookup. Default: empty (everything visible).
 */
export function useHiddenSections(): {
  hidden: ReadonlySet<SidebarSectionKey>;
  toggle: (key: SidebarSectionKey) => void;
} {
  const globalStateService = useService(GlobalStateService);
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const storageKey = storageKeyFor(workspaceId);

  const hidden$ = LiveData.from<string[] | undefined>(
    globalStateService.globalState.watch<string[]>(storageKey),
    undefined
  );
  const hiddenList = useLiveData(hidden$) ?? [];
  const hidden: ReadonlySet<SidebarSectionKey> = new Set(
    hiddenList.filter(isSidebarSectionKey)
  );

  const toggle = useCallback(
    (key: SidebarSectionKey) => {
      const stored =
        globalStateService.globalState.get<string[]>(storageKey) ?? [];
      const next = new Set(stored.filter(isSidebarSectionKey));
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      globalStateService.globalState.set(storageKey, Array.from(next));
    },
    [globalStateService, storageKey]
  );

  return { hidden, toggle };
}

function isSidebarSectionKey(value: string): value is SidebarSectionKey {
  return (SIDEBAR_SECTION_KEYS as readonly string[]).includes(value);
}

interface SectionVisibilityEditorProps {
  children: ReactNode;
}

/**
 * Popover that lists every customizable sidebar section with an eye-toggle.
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
  const descriptors = useMemo(() => getSectionDescriptors(t), [t]);
  const { hidden, toggle } = useHiddenSections();

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
            <span className={sectionEditorTitle}>Sections</span>
          </div>
          {descriptors.map(({ key, label }) => {
            const isHidden = hidden.has(key);
            return (
              <div
                key={key}
                className={sectionEditorRow}
                role="button"
                tabIndex={0}
                aria-pressed={!isHidden}
                data-testid={`sidebar-section-toggle-${key}`}
                onClick={() => toggle(key)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(key);
                  }
                }}
              >
                <span className={sectionEditorLabel}>{label}</span>
                <span
                  className={sectionEditorEye}
                  data-hidden={isHidden ? 'true' : 'false'}
                  aria-label={isHidden ? 'Show section' : 'Hide section'}
                >
                  {isHidden ? <HidePanelIcon /> : <EyePanelIcon />}
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
      <span>Sections</span>
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
