import type { DocMode } from '@blocksuite/affine/model';
import type { DocMeta } from '@blocksuite/affine/store';
import { Entity, LiveData } from '@toeverything/infra';
import type { DocProperties } from '../../db';
import type { DocPropertiesStore } from '../stores/doc-properties';
import type { DocsStore } from '../stores/docs';
/**
 * # DocRecord
 *
 * Some data you can use without open a doc.
 */
export declare class DocRecord extends Entity<{
    id: string;
}> {
    private readonly docsStore;
    private readonly docPropertiesStore;
    id: string;
    constructor(docsStore: DocsStore, docPropertiesStore: DocPropertiesStore);
    meta$: LiveData<DocMeta>;
    properties$: LiveData<{
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
    property$(propertyId: string): LiveData<string | undefined | null>;
    customProperty$(propertyId: string): LiveData<string | undefined | null>;
    setCustomProperty(propertyId: string, value: string): void;
    getProperties(): {
        [x: string]: any;
    };
    updateProperties(properties: Partial<DocProperties>): void;
    setProperty<Key extends keyof DocProperties>(propertyId: Key, value: DocProperties[Key]): void;
    setMeta(meta: Partial<DocMeta>): void;
    primaryMode$: LiveData<DocMode>;
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
    moveToTrash(): void;
    restoreFromTrash(): void;
    title$: LiveData<any>;
    trash$: LiveData<any>;
    createdAt$: LiveData<any>;
    updatedAt$: LiveData<any>;
    createdBy$: LiveData<string | null | undefined>;
    updatedBy$: LiveData<string | null | undefined>;
    setCreatedAt(createdAt: number): void;
    setUpdatedAt(updatedAt: number): void;
    setCreatedBy(createdBy: string): void;
    setUpdatedBy(updatedBy: string): void;
}
//# sourceMappingURL=record.d.ts.map