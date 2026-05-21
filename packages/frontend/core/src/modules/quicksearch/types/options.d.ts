import type { I18nString } from '@affine/i18n';
export interface QuickSearchOptions {
    label?: I18nString;
    placeholder?: I18nString;
    defaultQuery?: string;
    /**
     * When true, the modal opens in the Notion-style enhanced layout:
     * filter chips, time-bucket grouping, right-side preview pane, and
     * a wider 920px modal frame.
     *
     * Default: false. Action pickers and command palettes keep the
     * compact 640px single-column layout.
     */
    enhancedLayout?: boolean;
}
//# sourceMappingURL=options.d.ts.map