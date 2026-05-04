import { Readable } from 'node:stream';

import type { Request } from 'express';

import { OneMB, readBufferWithLimit } from '../../base';
import type { PromptTools } from './providers/types';
import type { ToolsConfig } from './types';

export const MAX_EMBEDDABLE_SIZE = 50 * OneMB;

export function readStream(
  readable: Readable,
  maxSize = MAX_EMBEDDABLE_SIZE
): Promise<Buffer> {
  return readBufferWithLimit(readable, maxSize);
}

type RequestClosedCallback = (isAborted: boolean) => void;
type SignalReturnType = {
  signal: AbortSignal;
  onConnectionClosed: (cb: RequestClosedCallback) => void;
};

export function getSignal(req: Request): SignalReturnType {
  const controller = new AbortController();

  let hasEnded = false;
  let callback: ((isAborted: boolean) => void) | undefined = undefined;

  const onSocketEnd = () => {
    hasEnded = true;
  };
  const onSocketClose = (hadError: boolean) => {
    req.socket.off('end', onSocketEnd);
    req.socket.off('close', onSocketClose);
    // NOTE: the connection is considered abnormally interrupted:
    // 1. there is an error when the socket is closed.
    // 2. the connection is closed directly without going through the normal end process (the client disconnects actively).
    const aborted = hadError || !hasEnded;
    if (aborted) {
      controller.abort();
    }

    callback?.(aborted);
  };

  req.socket.on('end', onSocketEnd);
  req.socket.on('close', onSocketClose);

  return {
    signal: controller.signal,
    onConnectionClosed: cb => (callback = cb),
  };
}

// ε-AI-INTEL v1.10: tool name groups for the new permission-mode flags.
// Each toolsConfig flag opts the chat session into the matching group.
// When a flag is `true`, missing tools are added; when `false`, present
// tools are removed. This is symmetric so the user's mode picker fully
// controls which write tools are active for the request, regardless of
// what the prompt template declared.
const EDITING_DOCS_TOOLS: PromptTools = [
  'docEdit',
  'sectionEdit',
  // doc-write tool file exports the doc Create/Update/UpdateMeta tools.
  'docCreate',
  'docUpdate',
  'docUpdateMeta',
];
const COMPOSING_DOCS_TOOLS: PromptTools = ['docCompose'];
const EDITING_DATA_VIEW_TOOLS: PromptTools = [
  'dataViewFilter',
  'dataViewAutofillColumn',
];

function addTools(current: PromptTools, additions: PromptTools): PromptTools {
  const next = [...current];
  for (const t of additions) {
    if (!next.includes(t)) {
      next.push(t);
    }
  }
  return next;
}

function removeTools(current: PromptTools, removals: PromptTools): PromptTools {
  const removalSet = new Set<PromptTools[number]>(removals);
  return current.filter(t => !removalSet.has(t));
}

export function getTools(
  tools?: PromptTools | null,
  toolsConfig?: ToolsConfig
) {
  if (!tools || !toolsConfig) {
    return tools;
  }
  let result: PromptTools = tools;
  (Object.keys(toolsConfig) as Array<keyof ToolsConfig>).forEach(key => {
    const value = toolsConfig[key];
    switch (key) {
      case 'searchWorkspace':
        if (value === false) {
          result = result.filter(tool => {
            return tool !== 'docKeywordSearch' && tool !== 'docSemanticSearch';
          });
        }
        break;
      case 'readingDocs':
        if (value === false) {
          result = result.filter(tool => {
            return tool !== 'docRead';
          });
        }
        break;
      // ε-AI-INTEL v1.10: write-tool groups. When `true`, opt the session
      // into all tools in the group (adding any not already present).
      // When `false`, remove the entire group from the request, even if
      // the prompt template would otherwise have included them.
      case 'editingDocs':
        result =
          value === true
            ? addTools(result, EDITING_DOCS_TOOLS)
            : removeTools(result, EDITING_DOCS_TOOLS);
        break;
      case 'composingDocs':
        result =
          value === true
            ? addTools(result, COMPOSING_DOCS_TOOLS)
            : removeTools(result, COMPOSING_DOCS_TOOLS);
        break;
      case 'editingDataViews':
        result =
          value === true
            ? addTools(result, EDITING_DATA_VIEW_TOOLS)
            : removeTools(result, EDITING_DATA_VIEW_TOOLS);
        break;
    }
  });
  return result;
}
