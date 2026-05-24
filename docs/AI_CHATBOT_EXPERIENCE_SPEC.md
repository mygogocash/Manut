# AI Chatbot Experience Spec - Claude Course Translation

> **Status:** Draft for implementation review
> **Date:** 2026-05-24
> **R-tier:** R1 overall because this affects the primary AI response path, model routing, tool use, and workspace trust. Individual slices below are mostly R2.

## Goal

Turn the Claude-course lessons into a Manut-native AI chat experience: fast by default, explicit about what it can do, grounded in workspace context, transparent when tools run, and evaluated before prompt changes ship.

## Scope In

- Backend copilot prompt, model routing, provider, tool, and retrieval paths under `packages/backend/server/src/plugins/copilot/`
- Frontend AI chat input, preferences, message rendering, and floating shell under `packages/frontend/core/src/blocksuite/ai/` and `packages/frontend/core/src/components/floating-ai-chat-anchor/`
- Prompt evaluation fixtures and tests for the chat prompt, mode addenda, tool selection, and retrieval behavior
- Existing streaming surfaces: SSE `/chat/:sessionId/stream-object` and flag-gated WebSocket transport

## Scope Out

- New provider accounts or secret provisioning
- Production deployment in this slice
- Replacing the existing AFFiNE copilot architecture
- Fully autonomous background agents without user-visible approval and rollback evidence

## Current Local Anchors

Manut already has the right primitives. The work should improve them rather than create a parallel chatbot:

- `controller.ts` already streams text/object responses, records chat history, gates AI budget, accepts `reasoning`, `webSearch`, `toolsConfig`, and resolves `modelId=auto`.
- `scenario-classifier.ts` already implements zero-latency task routing for Auto model selection.
- `preference-popup.ts` already exposes Mode, Advanced tool toggles, Model, Extended Thinking, and workspace search toggles.
- `utils/modes.ts` already maps Read/Edit/Agent to canonical tool sets.
- `providers/loop.ts` already handles multi-turn tool use, invalid JSON tool arguments, and parallel execution of multiple tool calls via `Promise.all`.
- `doc-keyword-search.ts` and `doc-semantic-search.ts` already provide the two halves of hybrid RAG.
- `ws/chat.events.ts` already defines richer events for token deltas, reasoning, tool progress, tool results, and memory pushes.
- `assistant.ts` already renders a streaming cursor, feedback chips, and a minimal "AI made changes" chip.

## Product Principles

1. **Workflow first, agent second.** Predictable tasks like summarize, extract action items, draft PRD, generate presentation, or tag docs should use tested workflows. Full Agent mode is for open-ended tasks where the exact steps are unknown.
2. **Use multiple model classes.** Treat Gemini Flash / Haiku-like models as fast routers and generators, Sonnet-class models as the default high-quality worker, and Opus/Pro models as opt-in for hard planning and multi-step reasoning.
3. **Stream useful state, not just text.** The user should see that the AI is searching docs, reading a source, editing a section, or waiting on a tool. A spinner alone is not enough.
4. **Ground answers in workspace evidence.** When the answer uses docs, Gmail, Calendar, GitHub, or web search, the response should show inspectable sources.
5. **Structured outputs must be validated.** Any prompt that expects JSON, NDJSON, code, regex, tags, or tool arguments needs a parser or forced schema path plus tests.
6. **Prompt changes need evals.** Do not tune important prompts by eyeballing one or two examples. Add a small dataset and objective graders first.
7. **Permissions are UX, not hidden config.** Read/Edit/Agent must clearly map to allowed tools and show when a write tool actually changed something.

## Requirements

### R1. Model Routing and Latency

- Auto mode routes simple questions, summarization, coding, image, audio, and complex planning to configured model IDs.
- Routing remains deterministic by default and cheap enough to run on every turn.
- Future LLM classification can be added only behind an eval and fallback path.
- Extended Thinking is offered only for models that support it and should be described as "slower, deeper reasoning" in UI copy.

### R2. Prompt Modes and System Behavior

- Read mode should answer with citations and ask before mutating.
- Edit mode may edit the current doc only.
- Agent mode may compose new docs, update metadata, run code, generate images, and use connected tools, subject to existing approval gates.
- Mode addenda should be task-behavior instructions, not product copy. Keep them short and direct.

### R3. Streaming and Tool Visibility

- Streaming text remains immediate.
- Reasoning chunks, tool-call starts, tool progress, tool results, and memory-push events are represented in the frontend stream model.
- Tool-call UI should distinguish read tools, write tools, external-account tools, and failed tools.
- For write tools, show what changed and provide an obvious route to inspect or undo where the underlying tool supports it.

### R4. Workspace Grounding and Citations

- Use keyword search by default for exact terms and semantic search for meaning-level matches.
- Merge keyword and semantic candidates with reciprocal rank fusion before giving them to the model.
- Add a rerank step only when candidate ambiguity is high or the query asks a nuanced cross-doc question.
- Answers that use retrieved docs should expose source chips or footnotes that open the referenced doc.
- Local or unsynced workspaces must keep returning explicit "sync required" messages instead of hallucinated answers.

### R5. Structured Output Reliability

- Internal structured prompts should use one of:
  - provider structured output support,
  - forced tool call with a JSON schema,
  - or strict parser plus retry.
- Stream-object consumers must keep extracting only `text-delta` chunks for `stream: false`.
- Add defensive rejecters for SSE/WS JSON wrapper fragments at every parse boundary.

### R6. Prompt Evaluation

- Add eval fixtures for real Manut chat tasks:
  - quick factual question
  - workspace-doc answer with citations
  - current-doc edit request
  - full-agent multi-tool task
  - structured JSON/tag extraction
  - Thai-language request
  - ambiguous request that should ask a clarification question
- Combine model-based grading with code-based checks where possible.
- Store score, model, prompt version, and failure reason in an artifact that can be compared across prompt revisions.

### R7. Provider-Specific Optimizations

- Anthropic prompt caching should be considered only where the provider path supports it. Cache stable tool schemas and system prompts, not dynamic user turns.
- Fine-grained tool argument streaming can be useful for responsiveness, but invalid JSON must remain visible to the tool loop and UI.
- PDF/image support should reuse the existing attachment abstraction and provider capability checks.

## Data Model Notes

No new database table is required for the first implementation slice.

Useful in-memory / persisted shapes:

- `StreamObject`: extend with optional source/progress metadata only after backend and frontend schemas are updated together.
- `AIToolsConfig.enabledTools`: remains the per-request allowlist.
- `chatMode.<workspaceId>` and `chatEnabledTools.<workspaceId>` remain the per-workspace frontend preference keys.
- Prompt eval datasets can start as versioned JSON fixtures in the repo.

Future DB-backed additions should wait until the stream/source contract proves stable:

- `AiPromptEvalRun`
- `AiPromptEvalCase`
- `AiRetrievedSource`

## Edge Cases

- User disables workspace search: answer without doc citations and say when workspace context was not searched.
- User asks for an edit in Read mode: explain that Edit or Agent mode is required.
- Tool arguments stream invalid JSON: surface the tool error and allow the model loop to recover.
- Tool returns empty search results: answer from available context and state that no matching workspace docs were found.
- User switches floating/sidebar/fullscreen during streaming: active session stays mounted.
- Budget cap is exceeded before generation: show budget error before starting a partial stream.
- Provider lacks reasoning/caching/structured-output support: silently omit unsupported provider options, but keep behavior covered by tests.
- Thai or mixed-language docs: preserve user language unless the prompt explicitly asks to translate.

## Task Breakdown

### T0 - Lock This Spec

- Intended behavior: The team has one repo-grounded contract for AI chat improvements before runtime changes begin.
- Tests: `git diff --check`
- Affected files: `docs/AI_CHATBOT_EXPERIENCE_SPEC.md`
- R-tier: R2
- Rollback: `git revert <spec-commit>`

### T1 - Add Prompt Eval Harness

- Intended behavior: Chat prompt and mode changes can be scored against repeatable Manut examples before deployment.
- Test names:
  - `chat prompt eval > given fixture dataset > then writes scored results`
  - `chat prompt eval > given structured-output case > then syntax grade is applied`
  - `chat prompt eval > given thai request > then output language is preserved`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/prompt/__tests__/`
  - `packages/backend/server/src/plugins/copilot/prompt/evals/`
  - optional helper under `scripts/`
- R-tier: R2
- Rollback: delete eval helper and fixtures; no production behavior changes.

### T2 - Tighten Mode Addenda

- Intended behavior: Read/Edit/Agent modes steer behavior through the system prompt as clearly as the tool allowlist already gates capability.
- Test names:
  - `mode addendum > given read mode > then write tools require user opt-in`
  - `mode addendum > given edit mode > then current-doc scope is explicit`
  - `mode addendum > given agent mode > then plan-act-report behavior is explicit`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/prompt/mode-addendum.ts`
  - `packages/backend/server/src/plugins/copilot/prompt/prompts.ts`
  - `packages/backend/server/src/plugins/copilot/prompt/__tests__/`
- R-tier: R2
- Rollback: revert mode addendum changes; tool allowlist still protects writes.

### T3 - Improve Auto Routing With Evals

- Intended behavior: Auto model selection uses task class, attachments, prompt length, and mode to pick the cheapest model that can do the job.
- Test names:
  - `scenario classifier > given quick short question > then routes to quick_decision_making`
  - `scenario classifier > given planning prompt in agent mode > then routes to complex_text_generation`
  - `scenario classifier > given image attachment edit prompt > then routes to image`
  - `scenario classifier > given code block > then routes to coding`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/prompt/scenario-classifier.ts`
  - `packages/backend/server/src/plugins/copilot/prompt/__tests__/scenario-classifier.spec.ts`
  - `packages/backend/server/src/plugins/copilot/controller.ts`
- R-tier: R2
- Rollback: revert classifier; default prompt model still works.

### T4 - Render Tool Progress and Source State

- Intended behavior: The chat transcript shows meaningful live statuses for search/read/edit/run-code/generate-image instead of hiding tool work behind a spinner.
- Test names:
  - `ws transport > given tool-progress event > then yields progress stream object`
  - `assistant message > given read tool call > then renders source status chip`
  - `assistant message > given failed tool result > then renders failed status chip`
  - `assistant message > given write tool result > then renders change chip with inspect action`
- Affected files:
  - `packages/frontend/core/src/blocksuite/ai/provider/ws-transport.ts`
  - `packages/frontend/core/src/blocksuite/ai/components/ai-chat-messages/type.ts`
  - `packages/frontend/core/src/blocksuite/ai/utils/stream-objects.ts`
  - `packages/frontend/core/src/blocksuite/ai/chat-panel/message/assistant.ts`
  - matching backend `StreamObjectSchema` if the event shape changes
- R-tier: R2
- Rollback: feature-flag progress rendering; existing text streaming still works.

### T5 - Hybrid Retrieval With Citation Contract

- Intended behavior: Workspace answers use keyword + semantic retrieval, merge with RRF, optionally rerank, and expose source links in the assistant message.
- Test names:
  - `doc retrieval > given exact term > then keyword result outranks semantic-only result`
  - `doc retrieval > given paraphrase > then semantic result is retained`
  - `doc retrieval > given overlapping candidates > then reciprocal rank fusion deduplicates`
  - `assistant message > given doc citations > then renders source chips`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/tools/doc-keyword-search.ts`
  - `packages/backend/server/src/plugins/copilot/tools/doc-semantic-search.ts`
  - new retrieval helper under `packages/backend/server/src/plugins/copilot/tools/`
  - `packages/frontend/core/src/blocksuite/ai/chat-panel/message/assistant.ts`
- R-tier: R2
- Rollback: remove merged retrieval helper and return to separate existing tools.

### T6 - Structured Output Guardrails

- Intended behavior: Structured-output features do not leak markdown wrappers, SSE fragments, or malformed JSON into user-visible data.
- Test names:
  - `stream object parser > given stream false response > then joins only text deltas`
  - `tool call accumulator > given invalid fine-grained JSON > then returns visible tool error`
  - `tag parser > given SSE wrapper fragments > then rejects malformed candidates`
- Affected files:
  - `packages/frontend/core/src/blocksuite/ai/provider/request.ts`
  - structured parsers such as tag/action parsers
  - `packages/backend/server/src/__tests__/copilot/tool-call-loop.spec.ts`
- R-tier: R2
- Rollback: revert parser changes; existing invalid-JSON handling remains.

### T7 - Workflow Library for Common Chat Jobs

- Intended behavior: Common jobs run through tested chains instead of one giant prompt.
- Test names:
  - `workflow chat > given action-items request > then runs extract then rewrite`
  - `workflow chat > given PRD request > then routes plan then final doc draft`
  - `workflow chat > given constraint violation > then repair step is invoked`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/workflow/`
  - `packages/backend/server/src/plugins/copilot/prompt/prompts.ts`
  - chat quick actions in `packages/frontend/core/src/blocksuite/ai/components/`
- R-tier: R2
- Rollback: disable workflow prompt/action names; regular chat remains.

### T8 - Provider Optimization Pass

- Intended behavior: Provider-specific features improve cost/latency without changing the user contract.
- Test names:
  - `anthropic request builder > given stable tools > then cache control is attached when supported`
  - `anthropic request builder > given dynamic user turn > then cache control is not attached`
  - `provider options > given unsupported model > then reasoning config is omitted`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/providers/anthropic/`
  - `packages/backend/server/src/plugins/copilot/providers/native.ts`
  - provider tests
- R-tier: R2
- Rollback: provider option changes are isolated; remove cache/reasoning metadata.

### T9 - MCP and Batch Tool Follow-Up

- Intended behavior: External integrations can be added as MCP servers or batchable tool groups without hardcoding every service inside copilot.
- Test names:
  - `tool registry > given independent read tools > then batch executes in parallel`
  - `mcp provider > given listed tools > then maps schema into copilot tool set`
  - `mcp provider > given tool error > then returns model-readable error`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/mcp/`
  - `packages/backend/server/src/plugins/copilot/tools/`
  - provider/tool-loop tests
- R-tier: R1 if public connector behavior changes; R2 for internal scaffolding.
- Rollback: feature-flag MCP/batch tool registration.

## Verification

Minimum checks for each implementation PR:

- Relevant AVA/unit specs for backend copilot changes
- Relevant frontend component specs for chat rendering changes
- `yarn eslint --no-cache <changed files>`
- `yarn oxlint <changed files>` where available
- `yarn prettier --check <changed files>`
- `git diff --check`
- For visible chat UI changes: local browser proof across floating, sidebar, and fullscreen modes
- Before deploy: `yarn affine bundle -p web`; add `-p @affine/server` when backend copilot code changes

## Rollback

- Keep each task as a separate commit or tightly scoped PR.
- Runtime behavior changes should be feature-flagged when possible.
- Revert order should be newest first unless a later task depends on an earlier schema/type extension.
- For deployed backend prompt/provider changes, rebuild `@affine/server` before image build; otherwise `Dockerfile.fullstack` will ship stale `dist/main.js`.

## Recommended First Vertical Slice

Start with T1 + T2 + a small part of T4:

1. Add eval fixtures and a runner for chat modes.
2. Tighten Read/Edit/Agent addenda and verify with evals.
3. Render existing `tool-call` / `tool-result` stream objects as readable status chips without changing backend event schemas.

This gives users a clearer AI experience quickly while keeping production risk low. Hybrid retrieval, citations, and provider caching should follow once the eval loop is in place.
