import { type ReactNode } from 'react';
export type QuickSearchInScope = 'current-doc' | 'current-folder' | 'parent-doc' | 'anywhere';
export interface QuickSearchFacet {
    id: string;
    label: string;
    enabled: boolean;
}
export interface QuickSearchFilters {
    titleOnly: boolean;
    createdBy: string | null;
    inScope: QuickSearchInScope;
    facets: ReadonlyArray<QuickSearchFacet>;
}
export interface WorkspaceMemberOption {
    id: string;
    name: string;
}
export interface FilterChipsProps {
    filters: QuickSearchFilters;
    onChange: (next: QuickSearchFilters) => void;
    members?: ReadonlyArray<WorkspaceMemberOption>;
}
export declare function FilterChips({ filters, onChange, members, }: FilterChipsProps): ReactNode;
//# sourceMappingURL=filter-chips.d.ts.map