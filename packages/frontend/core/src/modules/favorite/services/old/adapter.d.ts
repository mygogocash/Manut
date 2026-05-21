import type { WorkspaceService } from '@affine/core/modules/workspace';
import { LiveData, Service } from '@toeverything/infra';
import type * as Y from 'yjs';
import type { FavoriteSupportTypeUnion } from '../../constant';
import type { FavoriteService } from '../favorite';
import { PagePropertyType, PageSystemPropertyId, type WorkspaceAffineProperties } from './schema';
/**
 * WorkspacePropertiesAdapter is a wrapper for workspace properties.
 * Users should not directly access the workspace properties via yjs, but use this adapter instead.
 *
 * Question for enhancement in the future:
 * May abstract the adapter for each property type, e.g. PagePropertiesAdapter, SchemaAdapter, etc.
 * So that the adapter could be more focused and easier to maintain (like assigning default values)
 * However the properties for an abstraction may not be limited to a single yjs map.
 *
 * @deprecated use docService.doc.properties$
 */
declare class WorkspacePropertiesAdapter {
    readonly workspaceService: WorkspaceService;
    readonly proxy: WorkspaceAffineProperties;
    readonly properties: Y.Map<any>;
    readonly properties$: LiveData<WorkspaceAffineProperties>;
    private ensuredRoot;
    private ensuredPages;
    get workspace(): import("@affine/core/modules/workspace").Workspace;
    constructor(workspaceService: WorkspaceService);
    ensureRootProperties(): void;
    ensurePageProperties(pageId: string): void;
    transact: any;
    get schema(): {
        pageProperties: {
            system: {
                tags: {
                    id: PageSystemPropertyId.Tags;
                    options: {
                        id: string;
                        color: string;
                        name: string;
                    }[];
                    type: PagePropertyType.Tags;
                    icon: string;
                    name: string;
                    source: string;
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
                journal: {
                    id: PageSystemPropertyId.Journal;
                    type: PagePropertyType.Date;
                    icon: string;
                    name: string;
                    source: "system";
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
            };
            custom: Record<string, {
                id: string;
                type: PagePropertyType;
                order: number;
                icon: string;
                name: string;
                source: "custom";
                required?: boolean | undefined;
                readonly?: boolean | undefined;
            }>;
        };
    } | undefined;
    /**
     * @deprecated
     */
    get favorites(): Record<string, {
        id: string;
        type: "doc" | "collection";
        value: boolean;
        order: string;
    }> | undefined;
    get pageProperties(): Record<string, {
        system: {
            tags: {
                id: PageSystemPropertyId.Tags;
                value: string[];
                visibility: "visible" | "hide" | "hide-if-empty";
            };
            journal: {
                id: PageSystemPropertyId.Journal;
                value: string | false;
                visibility: "visible" | "hide" | "hide-if-empty";
            };
        };
        custom: Record<string, {
            id: string;
            order: string;
            visibility: "visible" | "hide" | "hide-if-empty";
            value?: any;
        }>;
    }> | undefined;
    getPageProperties(pageId: string): {
        system: {
            tags: {
                id: PageSystemPropertyId.Tags;
                value: string[];
                visibility: "visible" | "hide" | "hide-if-empty";
            };
            journal: {
                id: PageSystemPropertyId.Journal;
                value: string | false;
                visibility: "visible" | "hide" | "hide-if-empty";
            };
        };
        custom: Record<string, {
            id: string;
            order: string;
            visibility: "visible" | "hide" | "hide-if-empty";
            value?: any;
        }>;
    } | null;
    getJournalPageDateString(id: string): string | false | undefined;
    setJournalPageDateString(id: string, date: string): void;
    /**
     * After the user completes the migration, call this function to clear the favorite data
     */
    markFavoritesMigrated(): void;
}
export declare class MigrationFavoriteItemsAdapter extends Service {
    readonly workspaceService: WorkspaceService;
    adapter: WorkspacePropertiesAdapter;
    constructor(workspaceService: WorkspaceService);
    favorites$: LiveData<{
        id: string;
        type: "doc" | "collection";
        value: boolean;
        order: string;
    }[]>;
    migrated$: LiveData<boolean>;
    getItems(): {
        id: string;
        type: "doc" | "collection";
        value: boolean;
        order: string;
    }[];
    markFavoritesMigrated(): void;
}
type CompatibleFavoriteSupportType = FavoriteSupportTypeUnion;
/**
 * A service written for compatibility,with the same API as old FavoriteItemsAdapter.
 */
export declare class CompatibleFavoriteItemsAdapter extends Service {
    private readonly favoriteService;
    constructor(favoriteService: FavoriteService);
    toggle(id: string, type: CompatibleFavoriteSupportType): void;
    isFavorite$(id: string, type: CompatibleFavoriteSupportType): LiveData<boolean>;
    isFavorite(id: string, type: CompatibleFavoriteSupportType): boolean;
    get favorites$(): LiveData<{
        id: string;
        order: string;
        type: "doc" | "collection";
        value: boolean;
    }[]>;
}
export {};
//# sourceMappingURL=adapter.d.ts.map