import { WidgetComponent } from '@blocksuite/affine/std';
import { nothing } from 'lit';
export declare const AFFINE_BLOCK_DIFF_WIDGET_FOR_PAGE = "affine-block-diff-widget-for-page";
export declare class AffineBlockDiffWidgetForPage extends WidgetComponent {
    static styles: import("lit").CSSResult;
    accessor currentIndex: number;
    _handleScroll(dir: 'prev' | 'next'): void;
    _handleAcceptAll(): Promise<void>;
    _handleRejectAll(): void;
    get diffService(): any;
    render(): import("lit-html").TemplateResult<1> | typeof nothing | null;
    connectedCallback(): void;
}
export declare const blockDiffWidgetForPage: any;
//# sourceMappingURL=page.d.ts.map