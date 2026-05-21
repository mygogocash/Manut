import type { PeekViewService } from '@affine/core/modules/peek-view';
import type { Signal } from '@preact/signals-core';
import { nothing } from 'lit';
import type { ToolError } from './type';
interface DocKeywordSearchToolCall {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: {
        query: string;
    };
}
interface DocKeywordSearchToolResult {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    args: {
        query: string;
    };
    result: Array<{
        title: string;
        docId: string;
    }> | ToolError | null;
}
declare const DocKeywordSearchResult_base: any;
export declare class DocKeywordSearchResult extends DocKeywordSearchResult_base {
    accessor data: DocKeywordSearchToolCall | DocKeywordSearchToolResult;
    accessor width: Signal<number | undefined> | undefined;
    accessor onOpenDoc: (docId: string, sessionId?: string) => void;
    accessor peekViewService: PeekViewService;
    renderToolCall(): import("lit-html").TemplateResult<1>;
    renderToolResult(): import("lit-html").TemplateResult<1> | typeof nothing;
    protected render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
export {};
//# sourceMappingURL=doc-keyword-search-result.d.ts.map