import { BlockStdScope } from '@blocksuite/affine/std';
import type { ExtensionType, Store } from '@blocksuite/affine/store';
import { nothing } from 'lit';
declare const PageEditor_base: any;
export declare class PageEditor extends PageEditor_base {
    static styles: import("lit").CSSResult;
    get host(): any;
    connectedCallback(): void;
    getUpdateComplete(): Promise<boolean>;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
    willUpdate(changedProperties: Map<string | number | symbol, unknown>): void;
    accessor doc: Store;
    accessor specs: ExtensionType[];
    accessor std: BlockStdScope;
}
declare global {
    interface HTMLElementTagNameMap {
        'page-editor': PageEditor;
    }
}
export {};
//# sourceMappingURL=page-editor.d.ts.map