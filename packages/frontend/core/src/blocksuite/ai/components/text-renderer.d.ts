import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { ColorScheme } from '@blocksuite/affine/model';
import type { ExtensionType, TransformerMiddleware } from '@blocksuite/affine/store';
import type { Signal } from '@preact/signals-core';
import { nothing, type PropertyValues } from 'lit';
import type { AffineAIPanelState } from '../widgets/ai-panel/type';
export type TextRendererOptions = {
    customHeading?: boolean;
    extensions?: ExtensionType[];
    additionalMiddlewares?: TransformerMiddleware[];
    testId?: string;
    affineFeatureFlagService?: FeatureFlagService;
    theme?: Signal<ColorScheme>;
    scrollable?: boolean;
};
declare const TextRenderer_base: any;
export declare class TextRenderer extends TextRenderer_base {
    static styles: import("lit").CSSResult;
    private _answers;
    private _maxContainerHeight;
    private readonly _clearTimer;
    private _doc;
    private _host;
    private readonly _query;
    private _timer?;
    private readonly _subscribeDocLinkClicked;
    private readonly _updateDoc;
    connectedCallback(): void;
    firstUpdated(): void;
    private disposeDoc;
    disconnectedCallback(): void;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
    shouldUpdate(changedProperties: PropertyValues): boolean;
    updated(changedProperties: PropertyValues): void;
    private accessor _container;
    private accessor _previewHost;
    accessor answer: string;
    accessor options: TextRendererOptions;
    accessor state: AffineAIPanelState | undefined;
}
export declare const createTextRenderer: (options: TextRendererOptions) => (answer: string, state?: AffineAIPanelState) => import("lit-html").TemplateResult<1>;
export declare const LitTextRenderer: import("@affine/component").ReactWebComponent<HTMLElement, {}>;
declare global {
    interface HTMLElementTagNameMap {
        'text-renderer': TextRenderer;
    }
}
export {};
//# sourceMappingURL=text-renderer.d.ts.map