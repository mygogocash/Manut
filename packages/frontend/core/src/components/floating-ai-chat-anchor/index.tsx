import { useConfirmModal } from '@affine/component';
import { CopilotClient } from '@affine/core/blocksuite/ai';
import {
  AIChatContent,
  type ChatContextValue,
} from '@affine/core/blocksuite/ai/components/ai-chat-content';
import type { ChatStatus } from '@affine/core/blocksuite/ai/components/ai-chat-messages';
import { AIProvider } from '@affine/core/blocksuite/ai/provider';
import type { PromptKey } from '@affine/core/blocksuite/ai/provider/prompt';
import type { QuickAction } from '@affine/core/blocksuite/ai/quick-actions';
import { getViewManager } from '@affine/core/blocksuite/manager/view';
import { NotificationServiceImpl } from '@affine/core/blocksuite/view-extensions/editor-view/notification-service';
import { SkeletonGroup } from '@affine/core/components/affine/skeleton';
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
import { SPRING_GENTLE, SPRING_TIGHT } from '@affine/core/utils/motion';
import { useI18n } from '@affine/i18n';
import { BlockStdScope } from '@blocksuite/affine/std';
import type { Workspace } from '@blocksuite/affine/store';
import { CloseIcon } from '@blocksuite/icons/rc';
import { useFramework, useLiveData, useService } from '@toeverything/infra';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { trackEvent } from '../../modules/telemetry';
import { ChatTabs } from './chat-tabs';
import { QuickActionsRow } from './quick-actions-row';
import * as styles from './styles.css';
import { useChatTabs } from './use-chat-tabs';
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

  // Manut Wave 6 E2.5 — multi-tab chat. The tab strip lives at the top
  // of the panel; each tab maps 1:1 to an existing `aiChatHistories`
  // row. Tabs persist via `useChatTabs` (workspace-scoped GlobalState).
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    registerTab,
    removeTab,
    updateTab,
  } = useChatTabs({ workspaceId });

  const activeTab = useMemo(
    () => tabs.find(t => t.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );

  // Context follows the active tab: if the tab has a pinned doc id,
  // the chip is locked to that doc and ignores nav changes. Otherwise
  // it falls back to the current page (existing E1.10 behavior). The
  // user-driven `contextDismissed` still wins in the no-pin case so
  // the "remove context" affordance keeps working.
  const activeDoc = useMemo(() => {
    if (activeTab?.pinnedDocId) {
      return {
        docId: activeTab.pinnedDocId,
        docType: 'page' as const,
        title: activeTab.title?.trim() || 'Pinned chat',
      };
    }
    return contextDismissed ? null : docContext;
  }, [activeTab, contextDismissed, docContext]);

  const [chatContent, setChatContent] = useState<AIChatContent | null>(null);
  const [isBodyProvided, setIsBodyProvided] = useState(false);
  // Per-tab session cache. Keyed by tab/session id so swapping tabs
  // doesn't lose the loaded conversation. The currently displayed
  // session is `sessionMap[activeTabId]` and gets pushed into the Lit
  // element's `session` field on every effect run.
  const [sessionMap, setSessionMap] = useState<Record<string, CopilotSession>>(
    {}
  );
  const [isCreating, setIsCreating] = useState(false);
  // status is tracked so future iterations can render an in-flight indicator
  // alongside the panel header. v1 keeps the slot quiet.
  const [, setStatus] = useState<ChatStatus>('idle');
  // Epic E1.10 — track message count so the empty-state quick-actions
  // strip can hide as soon as the user (or AI) adds a message. Updated
  // from the Lit element's onContextChange callback below.
  const [hasMessages, setHasMessages] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const currentSession = activeTabId ? (sessionMap[activeTabId] ?? null) : null;

  // The Lit AIChatContent's `createSession` slot still needs to point at
  // ONE create function so the existing input wiring works. We thread
  // it to the active tab: if a session already exists for this tab,
  // return it; otherwise create a new chat that lives under the active
  // tab. This keeps the v1 single-chat code path intact for users who
  // never spawn additional tabs.
  const createSession = useCallback(
    async (options: Partial<BlockSuitePresets.AICreateSessionOptions> = {}) => {
      // React 19 preserve-manual-memoization: read fresh state inside
      // the callback so it isn't stale when the user opens the panel,
      // closes it, and re-opens — the active tab may have changed.
      const currentActive = activeTabId;
      if (currentActive && sessionMap[currentActive]) {
        return sessionMap[currentActive];
      }
      const session = await client.createSessionWithHistory({
        workspaceId,
        promptName: 'Chat With AFFiNE AI' satisfies PromptKey,
        reuseLatestChat: false,
        // Auto-attach the active doc so the AI sees its content as
        // context. Re-attaching on every send is handled by the chat
        // content element.
        docId: activeDoc?.docId,
        // If the active tab is pinned, persist that on the server so a
        // reopened panel keeps the lock. Server defaults to null when
        // omitted.
        ...(activeTab?.pinnedDocId
          ? { pinnedDocId: activeTab.pinnedDocId }
          : {}),
        ...options,
      });
      const newId = session.sessionId;
      setSessionMap(prev => ({ ...prev, [newId]: session }));
      // Auto-register / refresh the tab so future swaps can find it.
      registerTab(
        {
          id: newId,
          title: session.title ?? null,
          pinnedDocId: activeTab?.pinnedDocId ?? null,
        },
        { activate: !currentActive }
      );
      return session;
    },
    [
      activeDoc?.docId,
      activeTab?.pinnedDocId,
      activeTabId,
      client,
      registerTab,
      sessionMap,
      workspaceId,
    ]
  );

  // Tab-strip handlers ------------------------------------------------------
  // Wrap the async create in a sync callback so the JSX prop expects
  // `() => void` (per oxlint typescript-eslint/no-misused-promises).
  // Errors flow through `client.createSessionWithHistory` -> error
  // boundary in the AIProvider login path; the `.catch` here is a
  // safety net for the lint rule + ensures the spinner clears even if
  // the promise rejects (we already clear in `finally`, but oxlint
  // requires a terminating catch).
  const handleCreateTab = useCallback(() => {
    if (isCreating) return;
    setIsCreating(true);
    (async () => {
      try {
        const session = await client.createSessionWithHistory({
          workspaceId,
          promptName: 'Chat With AFFiNE AI' satisfies PromptKey,
          reuseLatestChat: false,
          docId: docContext?.docId,
        });
        setSessionMap(prev => ({ ...prev, [session.sessionId]: session }));
        registerTab(
          {
            id: session.sessionId,
            title: session.title ?? null,
            pinnedDocId: null,
          },
          { activate: true }
        );
      } finally {
        setIsCreating(false);
      }
    })().catch(() => {
      // swallowed — the underlying client already routes auth errors
      // through `resolveError` (see CopilotClient.createSessionWithHistory).
    });
  }, [client, docContext?.docId, isCreating, registerTab, workspaceId]);

  const handleSelectTab = useCallback(
    (id: string) => {
      setActiveTabId(id);
    },
    [setActiveTabId]
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      removeTab(id);
      setSessionMap(prev => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [removeTab]
  );

  // Backend's `generateTitle` job updates `session.title` asynchronously
  // after the first reply lands. Mirror that back into the tab strip so
  // the user sees the chat's title rather than "New chat" forever.
  useEffect(() => {
    if (!activeTabId) return;
    const session = sessionMap[activeTabId];
    if (!session) return;
    const nextTitle = session.title ?? null;
    const tabSnapshot = tabs.find(t => t.id === activeTabId);
    if (tabSnapshot && tabSnapshot.title !== nextTitle) {
      updateTab(activeTabId, { title: nextTitle });
    }
  }, [activeTabId, sessionMap, tabs, updateTab]);

  const onContextChange = useCallback((context: Partial<ChatContextValue>) => {
    setStatus(context.status ?? 'idle');
    // Mirror the messages-length signal so QuickActionsRow can hide
    // once the chat actually starts. `messages` only appears on the
    // partial when AIChatContent updates it — guard against missing
    // values so unrelated status updates don't reset our flag.
    if (context.messages !== undefined) {
      setHasMessages(context.messages.length > 0);
    }
  }, []);

  const onChatContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    chatContainerRef.current = node;
    setIsBodyProvided(true);
  }, []);

  // Epic E1.10 — clicking a quick-action chip pushes the prompt into
  // the existing AIChatInput via the AIProvider slot mechanism. The
  // input's connectedCallback subscribes to requestSendWithChat and
  // auto-submits when the host matches, so we get a single round-trip
  // from chip click to in-flight chat with no manual textarea poking.
  const handleQuickActionSelect = useCallback(
    (action: QuickAction) => {
      const host = mockStd?.host;
      if (!host) {
        // Fall back to filling the textarea directly when there's no
        // editor host (shouldn't happen in the floating panel — the
        // workspace always boots with at least one doc — but stay
        // defensive in case the order-of-operations changes).
        const textarea =
          chatContainerRef.current?.querySelector<HTMLTextAreaElement>(
            '[data-testid="chat-panel-input"]'
          );
        if (!textarea) return;
        textarea.value = action.prompt;
        textarea.focus();
        textarea.dispatchEvent(
          new Event('input', { bubbles: true, composed: true })
        );
        return;
      }
      AIProvider.slots.requestSendWithChat.next({
        host,
        input: action.prompt,
      });
    },
    [mockStd]
  );

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

      {/* Manut Wave 6 E2.5 — multi-tab strip. Mounts only when at least
          one tab is registered so the panel keeps its slim look on first
          open until the user (or the createSession effect) registers
          the initial tab. */}
      {tabs.length > 0 ? (
        <ChatTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={handleSelectTab}
          onClose={handleCloseTab}
          onCreate={handleCreateTab}
          isCreating={isCreating}
        />
      ) : null}

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

      {!hasMessages && isBodyProvided ? (
        <QuickActionsRow onSelect={handleQuickActionSelect} />
      ) : null}

      <div className={styles.panelBody} ref={onChatContainerRef} />
      {!isBodyProvided ? (
        // Manut M2 E2.7 — replace the static "Loading chat…" string with
        // a brand-shimmer skeleton card. Keeps the panel from feeling
        // empty on first open while the heavy AIChatContent Lit element
        // mounts (typically 100–300ms depending on cold cache).
        <div className={styles.panelPlaceholder}>
          <SkeletonGroup lines={4} animation="shimmer" />
        </div>
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

  const toggle = useCallback(
    () =>
      setOpen(prev => {
        // Telemetry fires only on the open transition; the close path is
        // intentionally silent (we only want to know how users get IN).
        if (!prev) {
          trackEvent('floating_chat_opened', { from: 'button' });
        }
        return !prev;
      }),
    []
  );
  const close = useCallback(() => setOpen(false), []);
  const dismissContext = useCallback(() => setContextDismissed(true), []);
  // Manut M2 E2.7 — respect reduced-motion when applying the press-scale
  // visual. When the user has the OS pref set, we still render the
  // motion.button (so layout stays identical), but skip the whileTap
  // scale and let the button just fire the click — no movement.
  const prefersReducedMotion = useReducedMotion();

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
        <motion.button
          type="button"
          className={styles.anchorButton}
          onClick={toggle}
          aria-label="Open Manut AI chat (⌘J)"
          data-testid="floating-ai-chat-anchor"
          data-open={open}
          // 0.97 press scale per implementation plan §B7 #5. Hover
          // scale to 1.05 with SPRING_TIGHT for the brand "lift on
          // pointer-over". Reduced motion users get no-ops on both
          // (Framer treats unset whileHover/whileTap as static).
          whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          transition={SPRING_TIGHT}
        >
          {/* Glyph is intentionally text-only — replace with an SVG glyph
              once the AI brand icon ships. Using "M" keeps bundle weight
              flat for v1. */}
          M
        </motion.button>
      </div>

      {/* Panel slide-in. We keep the .panel CSS class for layout +
          shadow + radius but drive the actual movement through framer-
          motion AnimatePresence so the slide rides SPRING_GENTLE
          instead of the upstream CSS cubic-bezier. The CSS class still
          carries the initial `transform: translateX(...)` for the
          first paint, then framer-motion takes over once mounted. */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="floating-chat-panel"
            className={styles.panel}
            data-open
            role="dialog"
            aria-label="Manut AI chat"
            initial={
              prefersReducedMotion
                ? { opacity: 1, x: 0 }
                : { opacity: 0, x: 32 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0, x: 0 }
                : { opacity: 0, x: 32 }
            }
            transition={prefersReducedMotion ? { duration: 0 } : SPRING_GENTLE}
          >
            <FloatingAiChatAnchorBody
              open={open}
              onClose={close}
              contextDismissed={contextDismissed}
              onDismissContext={dismissContext}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};
