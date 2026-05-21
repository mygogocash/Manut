import type { PropsWithChildren } from 'react';
import type { TagColor, TagLike } from './types';
type TagEditMenuProps = PropsWithChildren<{
    onTagDelete: (tagId: string) => void;
    colors: TagColor[];
    tag: TagLike;
    onTagChange: (property: keyof TagLike, value: string) => void;
    jumpToTag?: (tagId: string) => void;
}>;
export declare const TagEditMenu: ({ tag, onTagDelete, children, jumpToTag, colors, onTagChange, }: TagEditMenuProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=tag-edit-menu.d.ts.map