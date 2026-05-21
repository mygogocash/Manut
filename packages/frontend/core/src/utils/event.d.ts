import type { BaseSyntheticEvent } from 'react';
export declare function stopPropagation(event: BaseSyntheticEvent): void;
export declare function preventDefault(event: BaseSyntheticEvent): void;
export declare function isNewTabTrigger(event?: React.MouseEvent | MouseEvent): boolean;
export declare function isNewViewTrigger(event?: React.MouseEvent | MouseEvent): boolean;
export declare function inferOpenMode(event?: React.MouseEvent | MouseEvent): "active" | "tail" | "new-tab";
//# sourceMappingURL=event.d.ts.map