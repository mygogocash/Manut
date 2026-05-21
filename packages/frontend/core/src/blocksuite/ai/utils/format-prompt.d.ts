export type OutputFormat = 'auto' | 'list' | 'table' | 'code' | 'image';
export interface OutputFormatOption {
    format: OutputFormat;
    label: string;
    /** Short copy shown under the chip in the picker. Kept terse. */
    description: string;
    /** When false the chip renders but cannot be picked. */
    enabled: boolean;
}
export declare const DEFAULT_FORMAT: OutputFormat;
export declare const OUTPUT_FORMAT_OPTIONS: readonly OutputFormatOption[];
/**
 * Resolve the system-prompt suffix for a given output format. Returns
 * an empty string for "auto" so callers can unconditionally append
 * the suffix without conditional branching.
 */
export declare function suffixForFormat(format: OutputFormat): string;
/**
 * Is a format selectable right now? Currently only `image` is gated
 * off behind the M3 image-generation rollout.
 */
export declare function isFormatEnabled(format: OutputFormat): boolean;
/**
 * Compose a final system prompt by appending the format suffix to a
 * caller-supplied base. Returns the base unchanged for "auto" so
 * upstream prompts stay byte-identical when no format chip is set.
 */
export declare function applyFormatSuffix(basePrompt: string, format: OutputFormat): string;
//# sourceMappingURL=format-prompt.d.ts.map