import { Store } from '@toeverything/infra';
import type { WorkspaceDBService } from '../../db';
import type { DocCustomPropertyInfo } from '../../db/schema/schema';
import type { WorkspaceService } from '../../workspace';
export declare class WorkspacePropertyStore extends Store {
    private readonly workspaceService;
    private readonly dbService;
    constructor(workspaceService: WorkspaceService, dbService: WorkspaceDBService);
    getWorkspaceProperties(): {
        type: keyof import("..").WorkspacePropertyTypes;
        id: string;
        show?: "always-show" | "always-hide" | "hide-when-empty" | null | undefined;
        icon?: string | null | undefined;
        name?: string | null | undefined;
        index?: string | null | undefined;
        additionalData?: any;
        isDeleted?: boolean | null | undefined;
    }[];
    createWorkspaceProperty(config: Omit<DocCustomPropertyInfo, 'id'> & {
        id?: string;
    }): {
        type: keyof import("..").WorkspacePropertyTypes;
        id: string;
        show?: "always-show" | "always-hide" | "hide-when-empty" | null | undefined;
        icon?: string | null | undefined;
        name?: string | null | undefined;
        index?: string | null | undefined;
        additionalData?: any;
        isDeleted?: boolean | null | undefined;
    };
    removeWorkspaceProperty(id: string): void;
    updateWorkspaceProperty(id: string, config: Partial<DocCustomPropertyInfo>): void;
    migrateLegacyWorkspaceProperty(id: string, override: Partial<DocCustomPropertyInfo>): void;
    createWorkspacePropertyFromBuiltIn(id: string, override: Partial<DocCustomPropertyInfo>): void;
    watchWorkspaceProperties(): import("rxjs").Observable<{
        type: keyof import("..").WorkspacePropertyTypes;
        id: string;
        show?: "always-show" | "always-hide" | "hide-when-empty" | null | undefined;
        icon?: string | null | undefined;
        name?: string | null | undefined;
        index?: string | null | undefined;
        additionalData?: any;
        isDeleted?: boolean | null | undefined;
    }[]>;
    private upgradeLegacyWorkspacePropertyInfoList;
    private getLegacyWorkspacePropertyInfoList;
    private watchLegacyWorkspacePropertyInfoList;
    private getLegacyWorkspacePropertyInfo;
}
//# sourceMappingURL=workspace-property.d.ts.map