import { EditorHost } from '@blocksuite/affine/std';
import { nothing } from 'lit';
import type { AIItemConfig } from './types';
declare const AISubItemList_base: any;
export declare class AISubItemList extends AISubItemList_base {
    static styles: import("lit").CSSResult;
    private readonly _handleClick;
    connectedCallback(): void;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
    accessor abortController: AbortController;
    accessor host: EditorHost;
    accessor item: AIItemConfig;
    accessor onClick: (() => void) | undefined;
}
declare global {
    interface HTMLElementTagNameMap {
        'ai-sub-item-list': AISubItemList;
    }
}
export {};
//# sourceMappingURL=ai-sub-item-list.d.ts.map