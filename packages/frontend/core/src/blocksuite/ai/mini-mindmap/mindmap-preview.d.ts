import type { SurfaceBlockModel } from '@blocksuite/affine/blocks/surface';
import type { ServiceProvider } from '@blocksuite/affine/global/di';
import { type MindmapElementModel, MindmapStyle } from '@blocksuite/affine/model';
import { type EditorHost } from '@blocksuite/affine/std';
import { type Store } from '@blocksuite/affine/store';
import { nothing } from 'lit';
declare const MiniMindmapPreview_base: any;
export declare class MiniMindmapPreview extends MiniMindmapPreview_base {
    static styles: import("lit").CSSResult;
    doc?: Store;
    mindmapId?: string;
    surface?: SurfaceBlockModel;
    get _mindmap(): MindmapElementModel | null;
    private _createTemporaryDoc;
    private _switchStyle;
    private _toMindmapNode;
    connectedCallback(): void;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
    accessor answer: string;
    accessor ctx: {
        get(): Record<string, unknown>;
        set(data: Record<string, unknown>): void;
    };
    accessor height: number;
    accessor host: EditorHost;
    accessor mindmapStyle: MindmapStyle | undefined;
    accessor portalHost: EditorHost;
    accessor templateShow: boolean;
}
type Node = {
    text: string;
    children: Node[];
};
export declare const markdownToMindmap: (answer: string, doc: Store, provider: ServiceProvider) => Node | null;
export {};
//# sourceMappingURL=mindmap-preview.d.ts.map