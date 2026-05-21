import type { DocMode } from '@blocksuite/affine/model';
import type { DocMeta } from '@blocksuite/affine/store';
import { Store } from '@toeverything/infra';
import type { WorkspaceService } from '../../workspace';
import type { DocPropertiesStore } from './doc-properties';
export declare class DocsStore extends Store {
    private readonly workspaceService;
    private readonly docPropertiesStore;
    constructor(workspaceService: WorkspaceService, docPropertiesStore: DocPropertiesStore);
    getBlockSuiteDoc(id: string): any;
    getBlocksuiteCollection(): any;
    createDoc(docId?: string): string;
    watchDocIds(): import("rxjs").Observable<string[]>;
    watchAllDocUpdatedDate(): import("rxjs").Observable<{
        id: string;
        updatedDate: number | undefined;
    }[]>;
    watchAllDocTagIds(): import("rxjs").Observable<{
        id: string;
        tags: string[];
    }[]>;
    watchAllDocCreateDate(): import("rxjs").Observable<{
        id: string;
        createDate: number;
    }[]>;
    watchAllDocTitle(): import("rxjs").Observable<{
        id: string;
        title: string;
    }[]>;
    watchNonTrashDocIds(): import("rxjs").Observable<string[]>;
    watchTrashDocIds(): import("rxjs").Observable<string[]>;
    watchDocMeta(id: string): import("rxjs").Observable<any>;
    watchDocListReady(): import("rxjs").Observable<boolean>;
    setDocMeta(id: string, meta: Partial<DocMeta>): void;
    setDocPrimaryModeSetting(id: string, mode: DocMode): {
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
    getDocPrimaryModeSetting(id: string): any;
    watchDocPrimaryModeSetting(id: string): import("rxjs").Observable<string | null | undefined>;
    waitForDocLoadReady(id: string): Promise<void>;
    addPriorityLoad(id: string, priority: number): () => void;
}
//# sourceMappingURL=docs.d.ts.map