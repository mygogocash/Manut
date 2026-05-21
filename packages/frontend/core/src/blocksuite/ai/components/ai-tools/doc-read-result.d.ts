import type { PeekViewService } from '@affine/core/modules/peek-view';
import type { Signal } from '@preact/signals-core';
import { nothing } from 'lit';
import type { ToolError } from './type';
interface DocReadToolCall {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: {
        doc_id: string;
    };
}
interface DocReadToolResult {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    args: {
        doc_id: string;
    };
    result: {
        /** Old result may not have docId */
        docId?: string;
        title: string;
        markdown: string;
    } | ToolError | null;
}
declare const DocReadResult_base: any;
export declare class DocReadResult extends DocReadResult_base {
    accessor data: DocReadToolCall | DocReadToolResult;
    accessor width: Signal<number | undefined> | undefined;
    accessor peekViewService: PeekViewService;
    renderToolCall(): import("lit-html").TemplateResult<1>;
    renderToolResult(): import("lit-html").TemplateResult<1> | typeof nothing;
    protected render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
export {};
//# sourceMappingURL=doc-read-result.d.ts.map