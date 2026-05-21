import type { DocMode } from '@blocksuite/affine/model';
import { Entity } from '@toeverything/infra';
import type { DocProperties } from '../../db';
import type { WorkspaceService } from '../../workspace';
import type { DocScope } from '../scopes/doc';
import type { DocsStore } from '../stores/docs';
export declare class Doc extends Entity {
    readonly scope: DocScope;
    private readonly store;
    private readonly workspaceService;
    constructor(scope: DocScope, store: DocsStore, workspaceService: WorkspaceService);
    /**
     * for convenience
     */
    get workspace(): import("../../workspace").Workspace;
    get id(): string;
    readonly yDoc: any;
    readonly blockSuiteDoc: Store;
    readonly record: import("./record").DocRecord;
    readonly meta$: import("@toeverything/infra").LiveData<DocMeta>;
    readonly properties$: import("@toeverything/infra").LiveData<{
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
    }>;
    readonly primaryMode$: import("@toeverything/infra").LiveData<DocMode>;
    readonly title$: import("@toeverything/infra").LiveData<any>;
    readonly trash$: import("@toeverything/infra").LiveData<any>;
    readonly createdAt$: import("@toeverything/infra").LiveData<any>;
    readonly updatedAt$: import("@toeverything/infra").LiveData<any>;
    readonly createdBy$: import("@toeverything/infra").LiveData<string | null | undefined>;
    readonly updatedBy$: import("@toeverything/infra").LiveData<string | null | undefined>;
    setCreatedAt(createdAt: number): void;
    setUpdatedAt(updatedAt: number): void;
    setCreatedBy(createdBy: string): void;
    setUpdatedBy(updatedBy: string): void;
    customProperty$(propertyId: string): import("@toeverything/infra").LiveData<string | null | undefined>;
    setProperty(propertyId: string, value: string): void;
    updateProperties(properties: Partial<DocProperties>): void;
    getProperties(): {
        [x: string]: any;
    };
    setCustomProperty(propertyId: string, value: string): void;
    setPrimaryMode(mode: DocMode): {
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
    getPrimaryMode(): any;
    togglePrimaryMode(): void;
    moveToTrash(): void;
    restoreFromTrash(): void;
    waitForSyncReady(): Promise<void>;
    addPriorityLoad(priority: number): () => void;
    changeDocTitle(newTitle: string): void;
}
//# sourceMappingURL=doc.d.ts.map