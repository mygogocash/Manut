import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { ColorScheme } from '@blocksuite/affine/model';
import { type EditorHost } from '@blocksuite/affine/std';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import type { Signal } from '@preact/signals-core';
import { nothing } from 'lit';
import type { ToolError } from './type';
interface SectionEditToolCall {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: {
        section: string;
        instructions: string;
    };
}
interface SectionEditToolResult {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    args: {
        section: string;
        instructions: string;
    };
    result: {
        content: string;
    } | ToolError | null;
}
declare const SectionEditTool_base: any;
export declare class SectionEditTool extends SectionEditTool_base {
    static styles: import("lit").CSSResult;
    accessor data: SectionEditToolCall | SectionEditToolResult;
    accessor extensions: ExtensionType[];
    accessor affineFeatureFlagService: FeatureFlagService;
    accessor notificationService: NotificationService;
    accessor theme: Signal<ColorScheme>;
    accessor host: EditorHost | null | undefined;
    accessor independentMode: boolean | undefined;
    private get selection();
    renderToolCall(): import("lit-html").TemplateResult<1>;
    renderToolResult(): import("lit-html").TemplateResult<1> | typeof nothing;
    private readonly notifySuccess;
    protected render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
export {};
//# sourceMappingURL=section-edit.d.ts.map