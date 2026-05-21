import { type SVGProps } from 'react';
export type DocListItemView = 'list' | 'grid' | 'masonry';
export declare const DocListViewIcon: ({ view, ...props }: {
    view: DocListItemView;
} & SVGProps<SVGSVGElement>) => import("react/jsx-runtime").JSX.Element;
export interface DocListItemProps {
    docId: string;
    groupId: string;
    /**
     * Optional flat index across all groups, used to stagger the entrance
     * animation. Only the first 8 indices receive a non-zero delay (see
     * `docs-list.tsx`); higher indices fall through to instant entrance to
     * keep scroll-induced remounts snappy.
     */
    staggerIndex?: number;
}
export declare const DocListItem: ({ staggerIndex, ...props }: DocListItemProps) => import("react/jsx-runtime").JSX.Element;
export declare const ListViewDoc: ({ docId }: DocListItemProps) => import("react/jsx-runtime").JSX.Element | null;
export declare const CardViewDoc: ({ docId }: DocListItemProps) => import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=doc-list-item.d.ts.map