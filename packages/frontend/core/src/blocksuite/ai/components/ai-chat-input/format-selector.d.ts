import { type OutputFormat } from '../../utils/format-prompt';
declare const FormatSelector_base: any;
export declare class FormatSelector extends FormatSelector_base {
    static styles: import("lit").CSSResult;
    accessor format: OutputFormat;
    accessor onChange: ((format: OutputFormat) => void) | undefined;
    accessor ariaLabel: string;
    private get _activeLabel();
    private readonly _openMenu;
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'chat-input-format-selector': FormatSelector;
    }
}
export {};
//# sourceMappingURL=format-selector.d.ts.map