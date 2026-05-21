import { ShadowlessElement } from '@blocksuite/affine/std';
import { nothing } from 'lit';
export declare class ChatContentPureText extends ShadowlessElement {
    static styles: import("lit").CSSResult;
    accessor text: string;
    accessor testId: string;
    stopPropagation(event: Event): void;
    protected render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
declare global {
    interface HTMLElementTagNameMap {
        'chat-content-pure-text': ChatContentPureText;
    }
}
//# sourceMappingURL=pure-text.d.ts.map