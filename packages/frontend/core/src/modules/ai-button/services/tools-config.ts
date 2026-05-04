import {
  createSignalFromObservable,
  type Signal,
} from '@blocksuite/affine/shared/utils';
import { LiveData, Service } from '@toeverything/infra';
import { map } from 'rxjs';

import type { GlobalStateService } from '../../storage';

const AI_TOOLS_CONFIG_KEY = 'AIToolsConfig';

export interface AIToolsConfig {
  searchWorkspace?: boolean;
  readingDocs?: boolean;
  // ε-AI-INTEL v1.10: write-tool flags. Default `false` so existing users keep
  // Read-only behavior on upgrade. Each flag opts the chat session into a
  // group of backend tools.
  // - editingDocs   → enables doc-edit, section-edit, doc-write
  //                   (docCreate/docUpdate/docUpdateMeta).
  // - composingDocs → enables doc-compose (creates new docs from prompts).
  // - editingDataViews → enables data-view-filter and
  //                      data-view-autofill-column.
  editingDocs?: boolean;
  composingDocs?: boolean;
  editingDataViews?: boolean;
}

export class AIToolsConfigService extends Service {
  constructor(private readonly globalStateService: GlobalStateService) {
    super();

    const { signal, cleanup: enabledCleanup } =
      createSignalFromObservable<AIToolsConfig>(this.config$, {
        searchWorkspace: true,
        readingDocs: true,
        editingDocs: false,
        composingDocs: false,
        editingDataViews: false,
      });
    this.config = signal;
    this.disposables.push(enabledCleanup);
  }

  config: Signal<AIToolsConfig>;

  private readonly config$ = LiveData.from(
    this.globalStateService.globalState.watch<AIToolsConfig>(
      AI_TOOLS_CONFIG_KEY
    ),
    undefined
  ).pipe(
    map(config => ({
      searchWorkspace: config?.searchWorkspace ?? true,
      readingDocs: config?.readingDocs ?? true,
      // Default `false` for write flags — existing users get Read-only mode
      // after the v1.10 upgrade and must explicitly opt in.
      editingDocs: config?.editingDocs ?? false,
      composingDocs: config?.composingDocs ?? false,
      editingDataViews: config?.editingDataViews ?? false,
    }))
  );

  setConfig = (data: Partial<AIToolsConfig>) => {
    this.globalStateService.globalState.set(AI_TOOLS_CONFIG_KEY, {
      ...this.config.value,
      ...data,
    });
  };
}
