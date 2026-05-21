import { type ReactNode } from 'react';
import { type WorkspaceMemberOption } from '../components/filter-chips';
import type { QuickSearchGroup } from '../types/group';
import type { QuickSearchItem } from '../types/item';
type Groups = {
    group?: QuickSearchGroup;
    items: QuickSearchItem[];
}[];
interface CMDKProps {
    className?: string;
    query: string;
    error?: ReactNode;
    inputLabel?: ReactNode;
    placeholder?: string;
    loading?: boolean;
    loadingProgress?: number;
    groups?: Groups;
    onSubmit?: (item: QuickSearchItem, newTab?: boolean) => void;
    onQueryChange?: (query: string) => void;
    /**
     * When 'timestamp', groups are bucketed into Today / Yesterday /
     * Past 7 / Past 30 / Older. Default 'source' preserves the legacy
     * grouping driven by each QuickSearchSession.
     */
    groupBy?: 'source' | 'timestamp';
    /**
     * Show Notion-style filter chips + right-side preview pane. Off by
     * default so existing call-sites (action pickers, etc.) keep their
     * compact single-column layout.
     */
    enhancedLayout?: boolean;
    members?: ReadonlyArray<WorkspaceMemberOption>;
}
export declare const CMDK: ({ className, query, groups: newGroups, error, inputLabel, placeholder, loading: newLoading, loadingProgress, onQueryChange, onSubmit, groupBy, enhancedLayout, members, }: React.PropsWithChildren<CMDKProps>) => import("react/jsx-runtime").JSX.Element;
interface CMDKGroupProps {
    group: {
        group?: QuickSearchGroup;
        items: QuickSearchItem[];
    };
    onSubmit?: (item: QuickSearchItem, newTab?: boolean) => void;
    query: string;
}
export declare const CMDKGroup: ({ group: { group, items }, onSubmit, query, }: CMDKGroupProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=cmdk.d.ts.map