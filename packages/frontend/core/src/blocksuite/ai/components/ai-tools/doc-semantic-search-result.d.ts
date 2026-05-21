import type { PeekViewService } from '@affine/core/modules/peek-view';
import type { Signal } from '@preact/signals-core';
import { nothing } from 'lit';
import type { DocDisplayConfig } from '../ai-chat-chips';
import type { ToolError } from './type';
interface DocSemanticSearchToolCall {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: {
        query: string;
    };
}
interface DocSemanticSearchToolResult {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    args: {
        query: string;
    };
    result: Array<{
        content: string;
        docId: string;
    }> | ToolError | null;
}
declare const DocSemanticSearchResult_base: any;
export declare class DocSemanticSearchResult extends DocSemanticSearchResult_base {
    accessor data: DocSemanticSearchToolCall | DocSemanticSearchToolResult;
    accessor width: Signal<number | undefined> | undefined;
    accessor docDisplayService: DocDisplayConfig;
    accessor onOpenDoc: (docId: string, sessionId?: string) => void;
    accessor peekViewService: PeekViewService;
    renderToolCall(): import("lit-html").TemplateResult<1>;
    renderToolResult(): import("lit-html").TemplateResult<1> | typeof nothing;
    protected render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
declare global {
    interface HTMLElementTagNameMap {
        'doc-semantic-search-result': DocSemanticSearchResult;
    }
}
export {};
//# sourceMappingURL=doc-semantic-search-result.d.ts.map