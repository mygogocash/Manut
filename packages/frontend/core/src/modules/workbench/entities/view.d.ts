import { Entity, LiveData } from '@toeverything/infra';
import type { Location, To } from 'history';
import type { ParseOptions } from 'query-string';
import type { ViewIconName } from '../constants';
import { ViewScope } from '../scopes/view';
import { SidebarTab } from './sidebar-tab';
export declare class View extends Entity<{
    id: string;
    defaultLocation?: To | undefined;
    title?: string;
    icon?: ViewIconName;
}> {
    scope: ViewScope;
    get id(): string;
    set id(id: string);
    sidebarTabs$: LiveData<SidebarTab[]>;
    scrollPositions: WeakMap<Location, number | {
        centerX: number;
        centerY: number;
        zoom: number;
    }>;
    _activeSidebarTabId$: LiveData<string | null>;
    activeSidebarTab$: LiveData<SidebarTab | null | undefined>;
    constructor();
    history: import("../../../utils/navigable-history").NavigableHistory;
    location$: LiveData<Location>;
    entries$: LiveData<Location[]>;
    size$: LiveData<number>;
    title$: LiveData<string>;
    icon$: LiveData<"edgeless" | "page" | "doc" | "attachment" | "allDocs" | "collection" | "tag" | "trash" | "ai" | "journal" | "pdf">;
    queryString$<T extends Record<string, unknown>>(options?: ParseOptions): LiveData<Partial<T>>;
    updateQueryString<T extends Record<string, unknown>>(patch: Partial<T>, { forceUpdate, parseNumbers, replace, }?: {
        forceUpdate?: boolean;
        parseNumbers?: boolean;
        replace?: boolean;
    }): void;
    push(path: To): void;
    go(n: number): void;
    replace(path: To): void;
    setSize(size?: number): void;
    addSidebarTab(id: string): string;
    removeSidebarTab(id: string): void;
    activeSidebarTab(id: string | null): void;
    getScrollPosition(): number | {
        centerX: number;
        centerY: number;
        zoom: number;
    } | undefined;
    setScrollPosition(position: number | {
        centerX: number;
        centerY: number;
        zoom: number;
    }): void;
    setTitle(title: string): void;
    setIcon(icon: ViewIconName): void;
}
//# sourceMappingURL=view.d.ts.map