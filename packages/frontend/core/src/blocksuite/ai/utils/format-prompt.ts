// Output-format chips that ride alongside the chat input. Each format
// maps to a short system-prompt suffix that biases the AI's output
// shape without overriding the underlying prompt's intent.
//
// Epic E1.10 — T-1.10.2. Five formats: Auto / List / Table / Code / Image.
// "Auto" is the default and adds no suffix (letting the model pick
// whatever shape best fits the user's request). The remaining four
// nudge toward a structured response.
//
// "Image" is intentionally surfaced in the UI but flagged disabled
// until the image-generation tool ships in M3 — see `isFormatEnabled`
// below. Selecting a disabled format is a no-op in the picker; the
// chip stays clickable for screen-reader discoverability but the
// dropdown disables it visually.

export type OutputFormat = 'auto' | 'list' | 'table' | 'code' | 'image';

export interface OutputFormatOption {
  format: OutputFormat;
  label: string;
  /** Short copy shown under the chip in the picker. Kept terse. */
  description: string;
  /** When false the chip renders but cannot be picked. */
  enabled: boolean;
}

export const DEFAULT_FORMAT: OutputFormat = 'auto';

export const OUTPUT_FORMAT_OPTIONS: readonly OutputFormatOption[] = [
  {
    format: 'auto',
    label: 'Auto',
    description: 'Let the AI pick the best shape.',
    enabled: true,
  },
  {
    format: 'list',
    label: 'List',
    description: 'Bulleted markdown list.',
    enabled: true,
  },
  {
    format: 'table',
    label: 'Table',
    description: 'Markdown table with headers.',
    enabled: true,
  },
  {
    format: 'code',
    label: 'Code',
    description: 'Fenced code block.',
    enabled: true,
  },
  {
    format: 'image',
    label: 'Image',
    description: 'Generate an image (rolling out in M3).',
    enabled: false,
  },
];

const FORMAT_SUFFIXES: Record<OutputFormat, string> = {
  auto: '',
  list: 'Format your response as a markdown list.',
  table:
    'Format your response as a markdown table with headers and rows. Keep cells short.',
  code: 'Format your response as a fenced markdown code block. Include the language hint after the opening fence when known.',
  image:
    'Generate an image that matches the request. Describe the image briefly in plain text if image generation is unavailable.',
};

/**
 * Resolve the system-prompt suffix for a given output format. Returns
 * an empty string for "auto" so callers can unconditionally append
 * the suffix without conditional branching.
 */
export function suffixForFormat(format: OutputFormat): string {
  return FORMAT_SUFFIXES[format] ?? '';
}

/**
 * Is a format selectable right now? Currently only `image` is gated
 * off behind the M3 image-generation rollout.
 */
export function isFormatEnabled(format: OutputFormat): boolean {
  return (
    OUTPUT_FORMAT_OPTIONS.find(option => option.format === format)?.enabled ??
    false
  );
}

/**
 * Compose a final system prompt by appending the format suffix to a
 * caller-supplied base. Returns the base unchanged for "auto" so
 * upstream prompts stay byte-identical when no format chip is set.
 */
export function applyFormatSuffix(
  basePrompt: string,
  format: OutputFormat
): string {
  const suffix = suffixForFormat(format);
  if (!suffix) return basePrompt;
  if (!basePrompt) return suffix;
  return `${basePrompt}\n\n${suffix}`;
}
