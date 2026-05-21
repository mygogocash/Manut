import { WidgetComponent } from '@blocksuite/affine/std';
import { nothing, type TemplateResult } from 'lit';
export declare const AFFINE_BLOCK_DIFF_WIDGET_FOR_BLOCK = "affine-block-diff-widget-for-block";
export declare class AffineBlockDiffWidgetForBlock extends WidgetComponent {
    static styles: import("lit").CSSResult;
    private _setDeletedStyle;
    private _clearDeletedStyle;
    private _renderDelete;
    private _renderInsert;
    private _renderUpdate;
    get diffService(): any;
    get userExtensions(): any;
    get blockIndex(): number;
    render(): TemplateResult<1> | typeof nothing;
    connectedCallback(): void;
}
export declare const blockDiffWidgetForBlock: any;
//# sourceMappingURL=block.d.ts.map