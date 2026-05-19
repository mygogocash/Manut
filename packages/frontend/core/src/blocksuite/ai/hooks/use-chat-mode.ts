// React hook for the Mode + per-tool enabledTools picker.
//
// Persists two pieces of state per-workspace via AIToolsConfigService
// (which writes to GlobalStateService under workspace-scoped keys —
// see services/tools-config.ts: chatMode.<workspaceId> +
// chatEnabledTools.<workspaceId>).
//
// The hook is the React-side surface. The Lit preference-popup reads
// the same persisted state directly via the service, so both consumers
// stay aligned on a single chokepoint.
//
// Selection semantics:
//   - Picking a mode resets enabledTools to MODE_TOOL_SET[mode].
//   - Toggling a single tool in Advanced view only updates
//     enabledTools; mode stays whatever it was. "Edit minus webSearch"
//     is a valid configuration and should not collapse into a Custom
//     mode label.

import { LiveData, useLiveData, useService } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { AIToolsConfigService } from '../../../modules/ai-button';
import {
  type AIToolName,
  type ChatMode,
  DEFAULT_MODE,
  defaultEnabledTools,
  MODE_TOOL_SET,
} from '../utils/modes';

export interface UseChatModeResult {
  mode: ChatMode;
  setMode: (next: ChatMode) => void;
  enabledTools: readonly AIToolName[];
  setEnabledTools: (next: readonly AIToolName[]) => void;
  toggleTool: (tool: AIToolName, enabled: boolean) => void;
}

export function useChatMode(workspaceId: string): UseChatModeResult {
  const toolsConfigService = useService(AIToolsConfigService);

  // Wrap each rxjs Observable from the service into a LiveData so the
  // useLiveData React hook can subscribe. LiveData.from accepts an
  // initial value to render synchronously before the first emission.
  const mode$ = useMemo(
    () =>
      LiveData.from(toolsConfigService.watchChatMode(workspaceId), undefined),
    [toolsConfigService, workspaceId]
  );
  const enabled$ = useMemo(
    () =>
      LiveData.from(
        toolsConfigService.watchEnabledTools(workspaceId),
        undefined
      ),
    [toolsConfigService, workspaceId]
  );

  const rawMode = useLiveData(mode$);
  const rawEnabled = useLiveData(enabled$);

  const mode: ChatMode =
    rawMode === 'read' || rawMode === 'edit' || rawMode === 'agent'
      ? rawMode
      : DEFAULT_MODE;
  const enabledTools: readonly AIToolName[] = useMemo(() => {
    if (Array.isArray(rawEnabled)) {
      return rawEnabled as AIToolName[];
    }
    return defaultEnabledTools(mode);
  }, [rawEnabled, mode]);

  const setMode = useCallback(
    (next: ChatMode) => {
      toolsConfigService.setChatMode(workspaceId, next);
      // Picking a mode resets enabledTools to that mode's defaults.
      // Stored explicitly so the next render reads through the watcher
      // rather than re-deriving from the (now stale) raw value.
      toolsConfigService.setEnabledTools(workspaceId, [...MODE_TOOL_SET[next]]);
    },
    [toolsConfigService, workspaceId]
  );

  const setEnabledTools = useCallback(
    (next: readonly AIToolName[]) => {
      toolsConfigService.setEnabledTools(workspaceId, next);
    },
    [toolsConfigService, workspaceId]
  );

  const toggleTool = useCallback(
    (tool: AIToolName, enabled: boolean) => {
      // Read fresh state inside the callback so we don't capture a
      // stale enabledTools list. The react-hooks/preserve-manual-
      // memoization rule (React 19) flags useCallback deps that change
      // on every render; reading via the service avoids closing over
      // the rendered value.
      const currentList =
        toolsConfigService.getEnabledTools(workspaceId) ??
        defaultEnabledTools(
          toolsConfigService.getChatMode(workspaceId) ?? DEFAULT_MODE
        );
      const without = currentList.filter(t => t !== tool);
      const nextList = enabled ? [...without, tool] : without;
      toolsConfigService.setEnabledTools(workspaceId, nextList);
    },
    [toolsConfigService, workspaceId]
  );

  return {
    mode,
    setMode,
    enabledTools,
    setEnabledTools,
    toggleTool,
  };
}
