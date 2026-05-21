export interface QuickSearchModalProps {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    /**
     * Wider variant for the Notion-style docs cmdk layout (split list +
     * preview pane). Defaults to false so action pickers and command
     * palettes keep their compact 640px width.
     */
    wide?: boolean;
}
export declare const QuickSearchModal: ({ onOpenChange, open, wide, children, }: React.PropsWithChildren<QuickSearchModalProps>) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=modal.d.ts.map