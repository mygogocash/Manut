import { ColorScheme } from '@blocksuite/affine/model';
import { WidgetComponent } from '@blocksuite/affine/std';
import { type AffineViewportOverlayWidget } from '@blocksuite/affine/widgets/viewport-overlay';
import { nothing, type PropertyValues } from 'lit';
import type { AIPanelGenerating } from './components/index.js';
import type { AffineAIPanelState, AffineAIPanelWidgetConfig } from './type.js';
export declare const AFFINE_AI_PANEL_WIDGET = "affine-ai-panel-widget";
export declare class AffineAIPanelWidget extends WidgetComponent {
    static styles: import("lit").CSSResult;
    private _abortController;
    private _answer;
    private readonly _clearDiscardModal;
    private readonly _clickOutside;
    private _discardModalAbort;
    private readonly _inputFinish;
    private _inputText;
    private readonly _onDocumentClick;
    private readonly _onKeyDown;
    private readonly _resetAbortController;
    private _selection?;
    private _stopAutoUpdate?;
    ctx: unknown;
    private readonly _stopWithConfirmation;
    private readonly _discardWithConfirmation;
    discard: () => void;
    /**
     * You can evaluate this method multiple times to regenerate the answer.
     */
    generate: () => void;
    hide: (shouldTriggerCallback?: boolean) => void;
    onInput: (text: string) => void;
    restoreSelection: () => void;
    setState: (state: AffineAIPanelState, reference: Element) => void;
    showStopModal: () => any;
    showDiscardModal: () => any;
    stopGenerating: () => void;
    toggle: (reference: Element, type: "input" | "generate") => void;
    get answer(): string | null;
    get inputText(): string | null;
    get viewportOverlayWidget(): AffineViewportOverlayWidget | null;
    private _autoUpdatePosition;
    private _calcPositionOptions;
    connectedCallback(): void;
    disconnectedCallback(): void;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
    protected willUpdate(changed: PropertyValues): void;
    accessor config: AffineAIPanelWidgetConfig | null;
    accessor generatingElement: AIPanelGenerating | null;
    accessor state: AffineAIPanelState;
    accessor appTheme: ColorScheme;
}
export declare const aiPanelWidget: any;
//# sourceMappingURL=ai-panel.d.ts.map