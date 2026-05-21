import type { Signal } from '@preact/signals-core';
import { nothing } from 'lit';
import type { ToolError } from './type';
interface WebSearchToolCall {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: {
        query: string;
    };
}
interface WebSearchToolResult {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    args: {
        query: string;
    };
    result: Array<{
        title: string;
        url: string;
        content: string;
        favicon: string;
        publishedDate: string;
        author: string;
    }> | ToolError | null;
}
declare const WebSearchTool_base: any;
export declare class WebSearchTool extends WebSearchTool_base {
    accessor data: WebSearchToolCall | WebSearchToolResult;
    accessor width: Signal<number | undefined> | undefined;
    renderToolCall(): import("lit-html").TemplateResult<1>;
    renderToolResult(): import("lit-html").TemplateResult<1> | typeof nothing;
    protected render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
export {};
//# sourceMappingURL=web-search.d.ts.map