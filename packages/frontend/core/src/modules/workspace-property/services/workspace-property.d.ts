import { LiveData, Service } from '@toeverything/infra';
import type { DocCustomPropertyInfo } from '../../db/schema/schema';
import type { WorkspacePropertyStore } from '../stores/workspace-property';
export declare class WorkspacePropertyService extends Service {
    private readonly workspacePropertiesStore;
    constructor(workspacePropertiesStore: WorkspacePropertyStore);
    properties$: LiveData<{
        type: keyof import("..").WorkspacePropertyTypes;
        id: string;
        show?: "always-show" | "always-hide" | "hide-when-empty" | null | undefined;
        icon?: string | null | undefined;
        name?: string | null | undefined;
        index?: string | null | undefined;
        additionalData?: any;
        isDeleted?: boolean | null | undefined;
    }[]>;
    sortedProperties$: LiveData<{
        type: keyof import("..").WorkspacePropertyTypes;
        id: string;
        show?: "always-show" | "always-hide" | "hide-when-empty" | null | undefined;
        icon?: string | null | undefined;
        name?: string | null | undefined;
        index?: string | null | undefined;
        additionalData?: any;
        isDeleted?: boolean | null | undefined;
    }[]>;
    propertyInfo$(id: string): LiveData<{
        type: keyof import("..").WorkspacePropertyTypes;
        id: string;
        show?: "always-show" | "always-hide" | "hide-when-empty" | null | undefined;
        icon?: string | null | undefined;
        name?: string | null | undefined;
        index?: string | null | undefined;
        additionalData?: any;
        isDeleted?: boolean | null | undefined;
    } | undefined>;
    updatePropertyInfo(id: string, properties: Partial<DocCustomPropertyInfo>): void;
    createProperty(properties: Omit<DocCustomPropertyInfo, 'id'> & {
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
    removeProperty(id: string): void;
    indexAt(at: 'before' | 'after', targetId?: string): string;
}
//# sourceMappingURL=workspace-property.d.ts.map