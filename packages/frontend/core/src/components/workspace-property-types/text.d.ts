import type { FilterParams } from '@affine/core/modules/collection-rules';
import type { GroupHeaderProps } from '../explorer/types';
import type { PropertyValueProps } from '../properties/types';
export declare const TextValue: ({ value, onChange, readonly, }: PropertyValueProps) => import("react/jsx-runtime").JSX.Element;
export declare const TextFilterValue: ({ filter, isDraft, onDraftCompleted, onChange, }: {
    filter: FilterParams;
    isDraft?: boolean;
    onDraftCompleted?: () => void;
    onChange?: (filter: FilterParams) => void;
}) => import("react/jsx-runtime").JSX.Element | null;
export declare const TextDocListProperty: ({ value }: {
    value: string;
}) => import("react/jsx-runtime").JSX.Element | null;
export declare const TextGroupHeader: ({ groupId, docCount }: GroupHeaderProps) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=text.d.ts.map