import type { Signal } from '@preact/signals-core';
import { nothing } from 'lit';
import type { ToolError } from './type';
interface WebCrawlToolCall {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: {
        url: string;
    };
}
interface WebCrawlToolResult {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    args: {
        url: string;
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
declare const WebCrawlTool_base: any;
export declare class WebCrawlTool extends WebCrawlTool_base {
    accessor data: WebCrawlToolCall | WebCrawlToolResult;
    accessor width: Signal<number | undefined> | undefined;
    renderToolCall(): import("lit-html").TemplateResult<1>;
    renderToolResult(): import("lit-html").TemplateResult<1> | typeof nothing;
    protected render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
export {};
//# sourceMappingURL=web-crawl.d.ts.map