import { Entity, LiveData } from '@toeverything/infra';
import type { GlobalDialogService, WorkspaceDialogService } from '../../dialogs';
import type { DocsService } from '../../doc';
import type { WorkbenchService } from '../../workbench';
import type { QuickSearchSession } from '../providers/quick-search-provider';
import type { QuickSearchItem } from '../types/item';
export interface VerbPayload {
    run: () => void;
}
export declare class VerbsQuickSearchSession extends Entity implements QuickSearchSession<'verbs', VerbPayload> {
    private readonly docsService;
    private readonly workbenchService;
    private readonly globalDialogService;
    private readonly workspaceDialogService;
    constructor(docsService: DocsService, workbenchService: WorkbenchService, globalDialogService: GlobalDialogService, workspaceDialogService: WorkspaceDialogService);
    query$: LiveData<string>;
    private readonly verbs$;
    items$: LiveData<QuickSearchItem<"verbs", VerbPayload>[]>;
    query(query: string): void;
}
//# sourceMappingURL=verbs.d.ts.map