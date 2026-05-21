import { LiveData, Store } from '@toeverything/infra';
import type { WorkspaceDBService } from '../../db';
import type { DocProperties } from '../../db/schema/schema';
import type { WorkspaceService } from '../../workspace';
export declare class DocPropertiesStore extends Store {
    private readonly workspaceService;
    private readonly dbService;
    constructor(workspaceService: WorkspaceService, dbService: WorkspaceDBService);
    updateDocProperties(id: string, config: Partial<DocProperties>): {
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
    getDocProperties(id: string): {
        [x: string]: any;
    };
    watchDocProperties(id: string): import("rxjs").Observable<{
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
    /**
     * find doc ids by property key and value
     *
     * this apis will not include legacy properties
     */
    watchPropertyAllValues(propertyKey: string): LiveData<Map<string, string | undefined>>;
    private upgradeLegacyDocProperties;
    private getLegacyDocProperties;
    private watchLegacyDocProperties;
}
//# sourceMappingURL=doc-properties.d.ts.map