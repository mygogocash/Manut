import { useConfirmModal } from '@affine/component';
import { CopilotClient } from '@affine/core/blocksuite/ai';
import {
  AIChatContent,
  type ChatContextValue,
} from '@affine/core/blocksuite/ai/components/ai-chat-content';
import type { ChatStatus } from '@affine/core/blocksuite/ai/components/ai-chat-messages';
import type { PromptKey } from '@affine/core/blocksuite/ai/provider/prompt';
import { getViewManager } from '@affine/core/blocksuite/manager/view';
import { NotificationServiceImpl } from '@affine/core/blocksuite/view-extensions/editor-view/notification-service';
import { useAIChatConfig } from '@affine/core/components/hooks/affine/use-ai-chat-config';
import { useAISpecs } from '@affine/core/components/hooks/affine/use-ai-specs';
import { useAISubscribe } from '@affine/core/components/hooks/affine/use-ai-subscribe';
import {
  AIDraftService,
  AIToolsConfigService,
} from '@affine/core/modules/ai-button';
import { AIModelService } from '@affine/core/modules/ai-button/services/models';
import {
  EventSourceService,
  GraphQLService,
  ServerService,
  SubscriptionService,
} from '@affine/core/modules/cloud';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { PeekViewService } from '@affine/core/modules/peek-view';
import { AppThemeService } from '@affine/core/modules/theme';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { BlockStdScope } from '@blocksuite/affine/std';
import type { Workspace } from '@blocksuite/affine/store';
import { CloseIcon } from '@blocksuite/icons/rc';
import { useFramework, useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as styles from './styles.css';
import { useCurrentDocContext } from './use-current-doc-context';
import { useFloatingChatShortcut } from './use-floating-chat-shortcut';

type CopilotSession = Awaited<ReturnType<CopilotClient['getSession']>>;

// Builds a minimal BlockStdScope so the Lit AIChatContent can mount without
// being tied to a specific editor. Same pattern as the dedicated /chat route
// (see desktop/pages/workspace/chat/index.tsx). The std is rendered once and
// re-used for the lifetime of the workspace.
function createMockStd(workspace: Workspace) {
  workspace.meta.initialize();
  const store = workspace.docs.values().next().value?.getStore();
  if (!store) return null;
  const std = new BlockStdScope({
    store,
    extensions: [...getViewManager().config.init().value.get('page')],
  });
  std.render();
  return std;
}

function useMockStd() {
  const workspace = useService(WorkspaceService).workspace;
  return useMemo(() => {
    if (!workspace) return null;
    return createMockStd(workspace.docCollection);
  }, [workspace]);
}

function useCopilotClient() {
  const graphqlService = useService(GraphQLService);
  const eventSourceService = useService(EventSourceService);
  return useMemo(
    () => new CopilotClient(graphqlService.gql, eventSourceService.eventSource),
    [graphqlService, eventSourceService]
  );
}

interface FloatingAiChatAnchorInnerProps {
  open: boolean;
  onClose: () => void;
  contextDismissed: boolean;
  onDismissContext: () => void;
}

// The body of the panel — owns the AIChatContent Lit element. Split out so
// the heavy services / mockStd are only resolved when the floating chat is
// actually enabled by the feature flag (the outer component returns null
// before this ever mounts).
function FloatingAiChatAnchorBody({
  open,
  onClose,
  contextDismissed,
  onDismissContext,
}: FloatingAiChatAnchorInnerProps) {
  const t = useI18n();
  const framework = useFramework();
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const client = useCopilotClient();
  const mockStd = useMockStd();
  const specs = useAISpecs();
  const handleAISubscribe = useAISubscribe();
  const { docDisplayConfig, searchMenuConfig, reasoningConfig } =
    useAIChatConfig();

  const { closeConfirmModal, openConfirmModal } = useConfirmModal();
  const notificationService = useMemo(
    () => new NotificationServiceImpl(closeConfirmModal, openConfirmModal),
    [closeConfirmModal, openConfirmModal]
  );

  const docContext = useCurrentDocContext();
  const activeDoc = contextDismissed ? null : docContext;

  const [chatContent, setChatContent] = useState<AIChatContent | null>(null);
  const [isBodyProvided, setIsBodyProvided] = useState(false);
  const [currentSession, setCurrentSession] = useState<CopilotSession | null>(
    null
  );
  // status is tracked so future iterations can render an in-flight indicator
  // alongside the panel header. v1 keeps the slot quiet.
  const [, setStatus] = useState<ChatStatus>('idle');
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const createSession = useCallback(
    async (options: Partial<BlockSuitePresets.AICreateSessionOptions> = {}) => {
      if (currentSession) return currentSession;
      const session = await client.createSessionWithHistory({
        workspaceId,
        promptName: 'Chat With AFFiNE AI' satisfies PromptKey,
        reuseLatestChat: false,
        // Auto-attach the active doc so the AI sees its content as context.
        // Re-attaching on every send is handled by the chat content element.
        docId: activeDoc?.docId,
        ...options,
      });
      setCurrentSession(session);
      return session;
    },
    [activeDoc?.docId, client, currentSession, workspaceId]
  );

  const onContextChange = useCallback((context: Partial<ChatContextValue>) => {
    setStatus(context.status ?? 'idle');
  }, []);

  const onChatContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    chatContainerRef.current = node;
    setIsBodyProvided(true);
  }, []);

  // Configure / append the Lit AIChatContent element. Same wire-up as the
  // /chat page, with `floatingMode` flipped so downstream styling can react.
  useEffect(() => {
    if (!open || !isBodyProvided || !chatContainerRef.current) return;

    let content = chatContent;
    if (!content) {
      content = new AIChatContent();
    }

    content.session = currentSession;
    content.workspaceId = workspaceId;
    content.docId = activeDoc?.docId;
    content.extensions = specs;
    content.host = mockStd?.host;
    content.docDisplayConfig = docDisplayConfig;
    content.searchMenuConfig = searchMenuConfig;
    content.reasoningConfig = reasoningConfig;
    content.onContextChange = onContextChange;
    content.affineFeatureFlagService = framework.get(FeatureFlagService);
    content.affineWorkspaceDialogService = framework.get(
      WorkspaceDialogService
    );
    content.peekViewService = framework.get(PeekViewService);
    content.affineThemeService = framework.get(AppThemeService);
    content.notificationService = notificationService;
    content.aiDraftService = framework.get(AIDraftService);
    content.aiToolsConfigService = framework.get(AIToolsConfigService);
    content.serverService = framework.get(ServerService);
    content.subscriptionService = framework.get(SubscriptionService);
    content.aiModelService = framework.get(AIModelService);
    content.onAISubscribe = handleAISubscribe;
    content.createSession = createSession;

    if (!chatContent) {
      content.independentMode = true;
      content.onboardingOffsetY = -100;
      chatContainerRef.current.append(content);
      setChatContent(content);
    }
  }, [
    activeDoc?.docId,
    chatContent,
    createSession,
    currentSession,
    docDisplayConfig,
    framework,
    handleAISubscribe,
    isBodyProvided,
    mockStd,
    notificationService,
    onContextChange,
    open,
    reasoningConfig,
    searchMenuConfig,
    specs,
    workspaceId,
  ]);

  return (
    <>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>
          {t['com.affine.ai.chat-panel.title']()}
        </span>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close chat panel"
          data-testid="floating-ai-chat-close"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>

      {activeDoc ? (
        <div className={styles.contextChipRow}>
          <span
            className={styles.contextChip}
            data-testid="floating-ai-chat-context-chip"
          >
            <span className={styles.contextChipTitle} title={activeDoc.title}>
              {activeDoc.title}
            </span>
            <button
              type="button"
              className={styles.contextChipRemove}
              onClick={onDismissContext}
              aria-label="Remove context"
              data-testid="floating-ai-chat-context-remove"
            >
              <CloseIcon width={12} height={12} />
            </button>
          </span>
        </div>
      ) : null}

      <div className={styles.panelBody} ref={onChatContainerRef} />
      {!isBodyProvided ? (
        <div className={styles.panelPlaceholder}>Loading chat…</div>
      ) : null}
    </>
  );
}

/**
 * FloatingAiChatAnchor — bottom-right ⌘J chat surface.
 *
 * Renders nothing unless the `floating_ai_chat` feature flag is enabled.
 * Owns:
 *   - bottom-right floating button (brand accent)
 *   - slide-in panel from the right edge (~240ms via affine animation tokens)
 *   - ⌘J / Ctrl+J global keyboard binding (Esc closes)
 *   - context chip auto-derived from the current workbench location
 *
 * The chat body reuses the existing AIChatContent Lit element (same component
 * that backs the dedicated `/chat` page and the right-sidebar chat tab), so
 * input/messages/tool-call rendering stay consistent across surfaces.
 */
export const FloatingAiChatAnchor = () => {
  const featureFlagService = useService(FeatureFlagService);
  // Read the flag through the typed accessor on the entity. The flag is
  // configured in modules/feature-flag/constant.ts. FlagsExt resolves to a
  // dynamic shape keyed by AFFINE_FLAGS, so `floating_ai_chat` is fully
  // typed once it lands in that constant.
  const enabled = useLiveData(featureFlagService.flags.floating_ai_chat.$);

  const [open, setOpen] = useState(false);
  const [contextDismissed, setContextDismissed] = useState(false);

  // Reset the context-dismissed flag whenever the panel closes so the next
  // open re-attaches the active doc by default.
  useEffect(() => {
    if (!open) setContextDismissed(false);
  }, [open]);

  const toggle = useCallback(() => setOpen(prev => !prev), []);
  const close = useCallback(() => setOpen(false), []);
  const dismissContext = useCallback(() => setContextDismissed(true), []);

  useFloatingChatShortcut({
    enabled: !!enabled,
    isOpen: open,
    onToggle: toggle,
    onClose: close,
  });

  if (!enabled) return null;

  return (
    <>
      <div className={styles.anchorContainer}>
        <button
          type="button"
          className={styles.anchorButton}
          onClick={toggle}
          aria-label="Open Manut AI chat (⌘J)"
          data-testid="floating-ai-chat-anchor"
          data-open={open}
        >
          {/* Glyph is intentionally text-only — replace with an SVG glyph
              once the AI brand icon ships. Using "M" keeps bundle weight
              flat for v1. */}
          M
        </button>
      </div>

      <div
        className={styles.panel}
        data-open={open}
        role="dialog"
        aria-label="Manut AI chat"
        aria-hidden={!open}
      >
        {open ? (
          <FloatingAiChatAnchorBody
            open={open}
            onClose={close}
            contextDismissed={contextDismissed}
            onDismissContext={dismissContext}
          />
        ) : null}
      </div>
    </>
  );
};
