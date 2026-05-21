import type { RootBlockModel } from '@blocksuite/affine/model';
import { WidgetComponent } from '@blocksuite/affine/std';
import { nothing } from 'lit';
import type { AIItemGroupConfig } from '../../components/ai-item/types.js';
import { AFFINE_EDGELESS_COPILOT_WIDGET } from './constant.js';
export declare class EdgelessCopilotWidget extends WidgetComponent<RootBlockModel> {
    static styles: import("lit").CSSResult;
    private _clickOutsideOff;
    private _copilotPanel;
    private _listenClickOutsideId;
    private _selectionModelRect;
    private _autoUpdateCleanup;
    groups: AIItemGroupConfig[];
    get gfx(): any;
    get selectionModelRect(): DOMRect;
    get selectionRect(): {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    get visible(): boolean;
    set visible(visible: boolean);
    private _showCopilotInput;
    private _createCopilotPanel;
    private _updateCopilotPanel;
    private _updateSelection;
    private _watchClickOutside;
    connectedCallback(): void;
    determineInsertionBounds(width?: number, height?: number): any;
    hideCopilotPanel(): void;
    lockToolbar(disabled: boolean): void;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
    private accessor _selectionRect;
    private accessor _visible;
    accessor selectionElem: HTMLDivElement;
}
export declare const edgelessCopilotWidget: any;
declare global {
    interface HTMLElementTagNameMap {
        [AFFINE_EDGELESS_COPILOT_WIDGET]: EdgelessCopilotWidget;
    }
}
export * from './constant';
//# sourceMappingURL=index.d.ts.map