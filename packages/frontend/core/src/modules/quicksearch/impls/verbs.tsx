import { track } from '@affine/track';
import {
  KeyboardIcon,
  PlusIcon,
  SettingsIcon,
  SignOutIcon,
  UploadIcon,
} from '@blocksuite/icons/rc';
import { Entity, LiveData } from '@toeverything/infra';

import type {
  GlobalDialogService,
  WorkspaceDialogService,
} from '../../dialogs';
import type { DocsService } from '../../doc';
import type { WorkbenchService } from '../../workbench';
import type { QuickSearchSession } from '../providers/quick-search-provider';
import type { QuickSearchGroup } from '../types/group';
import type { QuickSearchItem } from '../types/item';

/**
 * High-frequency verb actions for Cmd+K (M2 E2.8 §B11).
 *
 * Distinct from the existing `CommandsQuickSearchSession` because
 * that session surfaces the entire AffineCommand registry — editor
 * commands, markdown shortcuts, edgeless tools, theme toggles, etc.
 * The verb set here is the small curated power-user palette the
 * plan asked for: top-level workspace actions that should be
 * discoverable from Cmd+K with no typing.
 *
 * Ranking: group score is set to 5 so verbs appear AT THE BOTTOM of
 * empty-query results (existing `affine:*` categories rank at 10).
 * This matches the plan's requirement: "These appear at the bottom
 * of CMDK results when no text typed."
 */

const verbsGroup = {
  id: 'verbs',
  label: { i18nKey: 'com.affine.cmdk.affine.category.affine.general' },
  // Rank LOWER than the affine:* categories (score 10) so verbs
  // appear at the bottom of empty-query results.
  score: 5,
} as QuickSearchGroup;

export interface VerbPayload {
  run: () => void;
}

function getTitle(item: QuickSearchItem<'verbs', VerbPayload>): string {
  const label = item.label;
  if (
    typeof label === 'object' &&
    'title' in label &&
    typeof label.title === 'string'
  ) {
    return label.title;
  }
  return '';
}

export class VerbsQuickSearchSession
  extends Entity
  implements QuickSearchSession<'verbs', VerbPayload>
{
  constructor(
    private readonly docsService: DocsService,
    private readonly workbenchService: WorkbenchService,
    private readonly globalDialogService: GlobalDialogService,
    private readonly workspaceDialogService: WorkspaceDialogService
  ) {
    super();
  }

  query$ = new LiveData('');

  private readonly verbs$ = LiveData.computed(() => {
    const docsService = this.docsService;
    const workbenchService = this.workbenchService;
    const globalDialogService = this.globalDialogService;
    const workspaceDialogService = this.workspaceDialogService;

    const verbs: QuickSearchItem<'verbs', VerbPayload>[] = [
      {
        id: 'verb:new-doc',
        source: 'verbs',
        label: { title: 'New doc' },
        group: verbsGroup,
        icon: <PlusIcon />,
        keyBinding: '$mod+N',
        payload: {
          run: () => {
            track.$.cmdk.creation.createDoc({ mode: 'page' });
            const doc = docsService.createDoc({ primaryMode: 'page' });
            workbenchService.workbench.openDoc(doc.id);
          },
        },
      },
      {
        id: 'verb:open-settings',
        source: 'verbs',
        label: { title: 'Open Settings' },
        group: verbsGroup,
        icon: <SettingsIcon />,
        keyBinding: '$mod+,',
        payload: {
          run: () => {
            workspaceDialogService.open('setting', {
              activeTab: 'appearance',
            });
          },
        },
      },
      {
        id: 'verb:open-shortcuts',
        source: 'verbs',
        label: { title: 'Open keyboard shortcuts' },
        group: verbsGroup,
        icon: <KeyboardIcon />,
        payload: {
          run: () => {
            workspaceDialogService.open('setting', {
              activeTab: 'shortcuts',
            });
          },
        },
      },
      {
        id: 'verb:invite-member',
        source: 'verbs',
        label: { title: 'Invite member' },
        group: verbsGroup,
        icon: <SettingsIcon />,
        payload: {
          run: () => {
            // Members panel is workspace-scoped — only meaningful
            // on cloud workspaces. The dialog system silently
            // discards the open call on local workspaces where
            // the tab is absent.
            workspaceDialogService.open('setting', {
              activeTab: 'workspace:members',
            });
          },
        },
      },
      {
        id: 'verb:import-workspace',
        source: 'verbs',
        label: { title: 'Import workspace' },
        group: verbsGroup,
        icon: <UploadIcon />,
        payload: {
          run: () => {
            globalDialogService.open('import-workspace', undefined);
          },
        },
      },
      {
        id: 'verb:sign-out',
        source: 'verbs',
        label: { title: 'Sign out' },
        group: verbsGroup,
        icon: <SignOutIcon />,
        payload: {
          run: () => {
            // The sign-out flow is owned by `useSignOut()` — a React
            // hook that lives at render time. From here we dispatch
            // a custom event the workspace shell can listen for
            // (see `desktop/pages/workspace/layouts/workspace-layout.tsx`
            // or wherever a future listener gets added). If no
            // listener handles it, this verb is a no-op — fine for
            // local workspaces where sign-out is meaningless.
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('affine:request-sign-out'));
            }
          },
        },
      },
    ];

    return verbs;
  });

  items$ = LiveData.computed(get => {
    const query = get(this.query$).trim().toLowerCase();
    const verbs = get(this.verbs$);
    if (!query) return verbs;
    return verbs.filter(v => getTitle(v).toLowerCase().includes(query));
  });

  query(query: string) {
    this.query$.next(query);
  }
}
