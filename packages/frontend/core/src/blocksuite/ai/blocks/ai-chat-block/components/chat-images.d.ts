import { LitElement, nothing } from 'lit';
export declare class ChatImage extends LitElement {
    static styles: import("lit").CSSResult;
    render(): import("lit-html").TemplateResult<1> | undefined;
    accessor imageUrl: string;
    accessor status: 'loading' | 'error' | 'success';
}
export declare class ChatImages extends LitElement {
    static styles: import("lit").CSSResult;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
    accessor attachments: string[] | undefined;
}
declare global {
    interface HTMLElementTagNameMap {
        'chat-image': ChatImage;
        'chat-images': ChatImages;
    }
}
//# sourceMappingURL=chat-images.d.ts.map