import type { DocMode } from '@blocksuite/affine/model';
import { Entity, LiveData } from '@toeverything/infra';
import type { DocsStore } from '../stores/docs';
import { DocRecord } from './record';
export declare class DocRecordList extends Entity {
    private readonly store;
    constructor(store: DocsStore);
    private readonly pool;
    readonly docsMap$: LiveData<Map<string, DocRecord>>;
    readonly docs$: LiveData<DocRecord[]>;
    readonly trashDocs$: LiveData<DocRecord[]>;
    readonly nonTrashDocsIds$: LiveData<string[]>;
    readonly isReady$: LiveData<boolean>;
    doc$(id: string): LiveData<DocRecord | undefined>;
    setPrimaryMode(id: string, mode: DocMode): {
        [x: string]: any;
        id: string;
        primaryMode?: string | null | undefined;
        edgelessColorTheme?: string | null | undefined;
        journal?: string | null | undefined;
        pageWidth?: string | null | undefined;
        isTemplate?: boolean | null | undefined;
        integrationType?: "readwise" | null | undefined;
        createdBy?: string | null | undefined;
        updatedBy?: string | null | undefined;
    };
    getPrimaryMode(id: string): any;
    togglePrimaryMode(id: string): any;
    primaryMode$(id: string): LiveData<any>;
}
//# sourceMappingURL=record-list.d.ts.map