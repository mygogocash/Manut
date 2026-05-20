import { z } from 'zod';

import type { ChatPrompt } from './prompt/chat-prompt';
import { PromptMessageSchema, PureMessageSchema } from './providers/types';

const takeFirst = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const zBool = z.preprocess(val => {
  const s = String(takeFirst(val)).toLowerCase();
  return ['true', '1', 'yes'].includes(s);
}, z.boolean().default(false));

const zMaybeString = z.preprocess(val => {
  const s = takeFirst(val);
  return s === '' || s == null ? undefined : s;
}, z.string().min(1).optional());

const ToolsConfigSchema = z.preprocess(
  val => {
    // if val is a string, try to parse it as JSON
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return {};
      }
    }
    return val || {};
  },
  // ε-AI-INTEL v1.10: the editing-flag map (search/read/edit groups)
  // remains the primary toolsConfig surface — each flag opts into a
  // backend tool group via `getTools()` in ./utils.ts.
  //
  // ε-AI-INTEL B8 / Epic E1.6: the optional `enabledTools` field
  // carries an explicit per-tool allowlist. When present, `getTools()`
  // filters the prompt's declared tool set by membership AFTER the
  // legacy flag mapping has been applied. Stored on the same flat
  // object as the flags so old clients keep posting
  // `{searchWorkspace: true, ...}` without any envelope change.
  z
    .object({
      searchWorkspace: z.boolean().optional(),
      readingDocs: z.boolean().optional(),
      editingDocs: z.boolean().optional(),
      composingDocs: z.boolean().optional(),
      editingDataViews: z.boolean().optional(),
      enabledTools: z.array(z.string()).optional(),
    })
    .passthrough()
    .default({})
);

export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;

export const ChatQuerySchema = z
  .object({
    messageId: zMaybeString,
    modelId: zMaybeString,
    retry: zBool,
    reasoning: zBool,
    webSearch: zBool,
    toolsConfig: ToolsConfigSchema,
  })
  .catchall(z.string())
  .transform(
    ({
      messageId,
      modelId,
      retry,
      reasoning,
      webSearch,
      toolsConfig,
      ...params
    }) => ({
      messageId,
      modelId,
      retry,
      reasoning,
      webSearch,
      toolsConfig,
      params,
    })
  );

// ======== ChatMessage ========

export const ChatMessageSchema = PromptMessageSchema.extend({
  id: z.string().optional(),
  createdAt: z.date(),
}).strict();
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatHistorySchema = z
  .object({
    userId: z.string(),
    sessionId: z.string(),
    workspaceId: z.string(),
    docId: z.string().nullable(),
    parentSessionId: z.string().nullable(),
    pinned: z.boolean(),
    title: z.string().nullable(),
    // Manut control plane: optional binding to the MnAgent that authored
    // this session. `null` for plain user chats. The heartbeat hook in
    // ChatSessionService.get() reads this off the in-memory state so it
    // does not need to re-query AiSession before recording a turn.
    agentId: z.string().nullable(),
    // Manut Wave 6 E2.5: per-tab pin in the floating multi-chat panel.
    // When non-null, the tab's context is locked to this doc and ignores
    // navigation; null = context follows the current page.
    pinnedDocId: z.string().nullable(),

    action: z.string().nullable(),
    model: z.string(),
    optionalModels: z.array(z.string()),
    promptName: z.string(),

    tokens: z.number(),
    messages: z.array(ChatMessageSchema),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict();

export type ChatHistory = z.infer<typeof ChatHistorySchema>;

export const SubmittedMessageSchema = PureMessageSchema.extend({
  sessionId: z.string(),
  content: z.string().optional(),
}).strict();
export type SubmittedMessage = z.infer<typeof SubmittedMessageSchema>;

// ======== Chat Session ========

export type ChatSessionOptions = Pick<
  ChatHistory,
  'userId' | 'workspaceId' | 'docId' | 'promptName' | 'pinned'
> & {
  reuseLatestChat?: boolean;
  // Manut Wave 6 E2.5: optional starting pin for the floating-chat tab.
  // Null/omitted = no pin (context follows nav); a doc id = lock the tab.
  pinnedDocId?: string | null;
};

export type ChatSessionForkOptions = Pick<
  ChatHistory,
  'userId' | 'sessionId' | 'workspaceId' | 'docId'
> & {
  latestMessageId?: string;
};

export type ChatSessionState = Pick<
  ChatHistory,
  'userId' | 'sessionId' | 'workspaceId' | 'docId' | 'messages' | 'agentId'
> & {
  prompt: ChatPrompt;
};

export type CopilotContextFile = {
  id: string; // fileId
  created_at: number;
  // embedding status
  status: 'in_progress' | 'completed' | 'failed';
};
