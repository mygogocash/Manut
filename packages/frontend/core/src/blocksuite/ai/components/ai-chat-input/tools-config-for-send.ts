import type { AIToolsConfig } from '@affine/core/modules/ai-button';

import type { OutputFormat } from '../../utils/format-prompt';

// M6: the "Image" output-format chip injects a text suffix but the backend
// only emits an image when the `imageGen` tool is in this request's
// enabledTools allowlist. This pure helper splices `imageGen` into the
// per-request tools-config when (and only when) the Image format is picked,
// so the chip's promise is truthful even for a default-mode user.
//
// `imageGen` is otherwise Agent-mode-only (see utils/modes.ts); this grants
// it for the single Image send without mutating the persisted config or the
// user's Mode selection. The update is immutable — the original config is
// returned unchanged for every non-image format.
export function toolsConfigForSend(
  config: Readonly<AIToolsConfig>,
  format: OutputFormat
): AIToolsConfig {
  if (format !== 'image') {
    return config;
  }
  const enabledTools = config.enabledTools ?? [];
  if (enabledTools.includes('imageGen')) {
    return config;
  }
  return {
    ...config,
    enabledTools: [...enabledTools, 'imageGen'],
  };
}
