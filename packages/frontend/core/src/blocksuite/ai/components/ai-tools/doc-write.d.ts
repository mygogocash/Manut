import type { PeekViewService } from '@affine/core/modules/peek-view';
import type { Signal } from '@preact/signals-core';
import { nothing } from 'lit';
import type { DocDisplayConfig } from '../ai-chat-chips';
import type { ToolError } from './type';
type DocWriteToolName = 'doc_create' | 'doc_update' | 'doc_update_meta';
type DocWriteToolArgs = {
    doc_id?: string;
    title?: string;
    content?: string;
};
interface DocWriteToolCall {
    type: 'tool-call';
    toolCallId: string;
    toolName: DocWriteToolName;
    args: DocWriteToolArgs;
}
interface DocWriteToolResult {
    type: 'tool-result';
    toolCallId: string;
    toolName: DocWriteToolName;
    args: DocWriteToolArgs;
    result: {
        success?: boolean;
        docId?: string;
        message?: string;
    } | ToolError | null;
}
declare const DocWriteTool_base: any;
export declare class DocWriteTool extends DocWriteTool_base {
    accessor data: DocWriteToolCall | DocWriteToolResult;
    accessor width: Signal<number | undefined> | undefined;
    accessor peekViewService: PeekViewService;
    accessor docDisplayService: DocDisplayConfig;
    accessor onOpenDoc: (docId: string, sessionId?: string) => void;
    private getDocId;
    private getDocTitle;
    private getToolIcon;
    private getCallLabel;
    private getResultLabel;
    private openDoc;
    renderToolCall(): import("lit-html").TemplateResult<1>;
    renderToolResult(): import("lit-html").TemplateResult<1> | typeof nothing;
    protected render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
declare global {
    interface HTMLElementTagNameMap {
        'doc-write-tool': DocWriteTool;
    }
}
export {};
//# sourceMappingURL=doc-write.d.ts.map