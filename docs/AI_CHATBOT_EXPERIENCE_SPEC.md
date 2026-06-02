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
- `providers/provider-middleware.ts` and `config.ts` already define provider request/stream/text middleware hooks. These are the right wrapper points for non-destructive interception.
- `AccessController` already gates workspace/doc permissions. The missing hardening is pushing authorized doc IDs into retrieval before vector search, not only filtering after candidates return.
- `MemoryRetrieveService` and `MemoryIngestService` already provide long-term user/workspace memory with best-effort failure isolation.

## Non-Destructive Interceptor Architecture

The Python/FastAPI middleware shape from the research should not be copied directly into this repo. Manut is a NestJS/TypeScript application with an existing copilot controller, provider abstraction, permission layer, and frontend stream contract. The right translation is a set of injectable services that intercept the current chat path while preserving the existing request and response schemas.

Target flow:

```text
client request
  -> CopilotController.prepareChatSession()
  -> ChatRequestInterceptorService
       -> identity context
       -> memory context
       -> permission filter
       -> retrieval routing hints
       -> provider cache options
  -> existing provider.streamObject() / provider.streamText()
  -> ChatResponseVerifierService in shadow or gated mode
  -> existing StreamObject / SSE / WS response shape
```

The first implementation must be transparent:

- no frontend schema change
- no new chat endpoint
- no provider replacement
- no blocking verification on every stream by default
- all new logic behind config flags or shadow mode until tests prove behavior

### Middleware Module Mapping

| Research module             | Manut-native module                                      | Existing anchor                                                    | First behavior                                                            |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Runtime identity context    | `ChatIdentityContextService`                             | `CurrentUser`, workspace/user models, `ChatPrompt.finish()` params | Inject role, workspace, locale, and safe project hints into prompt params |
| Short-term scratchpad       | `ChatScratchpadService`                                  | session id, WS tool progress, existing cache if available          | TTL-scoped tool state only; no durable facts                              |
| Long-term episodic memory   | existing memory services plus `MemoryPreferenceService`  | `MemoryRetrieveService`, `MemoryIngestService`, `MemoryResolver`   | View/forget/tweak user memories before expanding writes                   |
| Shared knowledge            | workspace docs, integrations, future directory connector | doc/search tools, Gmail/Calendar/GitHub tools                      | Treat as retrieved evidence, not user memory                              |
| GraphRAG routing            | `OrgGraphRouterService`                                  | Knowledge Graph pulses, future org/directory adapter               | Route org-chart questions to graph query tool instead of vector search    |
| Permission-aware RAG        | `AuthorizedRetrievalFilterService`                       | `AccessController`, doc search tools                               | Resolve allowed doc IDs before vector/keyword lookup                      |
| Self-correction loop        | `ChatResponseVerifierService`                            | `streamObjects`, prompt eval runner, model router                  | Shadow-grade claims against retrieved chunks; surface corrections later   |
| Confidence/sycophancy guard | `ChatRiskEvaluatorService`                               | mode addenda, provider text middleware                             | Add uncertainty metadata/disclaimers when evidence is weak                |
| Prompt caching              | provider request middleware                              | `providers/anthropic`, `providers/native.ts`                       | Cache stable tool schemas/system prompt only where supported              |
| vLLM suffix decoding        | deployment config only                                   | no current vLLM runtime                                            | Document optional future config; do not block Vertex path                 |

## Security Contract

The research highlights a real gap: filtering after vector search is not strong enough for a zero-leakage enterprise chatbot. The search backend should receive a hard allowlist so unauthorized chunks are never scanned.

Required retrieval invariant:

```text
authorizedDocIds = getAuthorizedDocumentIds(userId, workspaceId, action=Doc.Read)
retrieval(query, filter={ workspaceId, docId: { in: authorizedDocIds }})
```

Until the indexer/context APIs accept hard doc-id filters, any "permission-aware RAG" claim must be treated as partial. Existing post-retrieval `AccessController.docs(..., 'Doc.Read')` checks are necessary but not sufficient for the stronger guarantee.

## Verification Strategy

Response verification should not destroy streaming latency. Roll it out in three levels:

1. **Shadow verification:** generate and stream normally, then asynchronously score the completed answer against retrieved evidence and store/verbalize diagnostics only in dev/admin logs.
2. **Soft correction:** for workspace-grounded answers, append a short correction or uncertainty note when the verifier detects unsupported claims.
3. **Hard gate:** only for high-risk admin/legal/payroll/security scopes, hold final text until evidence verification passes.

This preserves the current chat UX while building evidence that the verifier improves quality.

Current implementation status: object-stream chat saves now run a shadow-only
verifier after the answer is complete. It compares workspace-source tool
results with final footnote definitions and logs missing or unsupported
citation warnings without changing the user's streamed answer.

Memory implementation status: the existing memory retrieval pipeline is now
wired through `ChatRequestInterceptorService` on each chat turn. Relevant
user/workspace memories are injected into the provider message list by default;
clients can opt out per request with `toolsConfig.memory=false`. Retrieval or
injection failures remain best-effort and fall back to the original prompt.

## Latency Strategy

- Keep Time To First Token fast by preserving current streaming.
- Put static prompt prefixes first only where provider request builders can preserve exact prefix identity.
- Cache stable tool schemas/system prompts, not user text, retrieved private docs, or mutable workspace state.
- Current cache implementation is planner-only: `planPromptCache` identifies
  stable Anthropic/Anthropic Vertex prefixes and refuses dynamic private
  context, but provider requests do not attach cache metadata until the native
  request contract can carry it safely.
- Use background verification and memory distillation for expensive work.
- Treat vLLM suffix/speculative decoding as optional infrastructure for future self-hosted model nodes. It does not apply to the current Vertex-first stack unless we introduce a vLLM deployment.

## Product Principles

1. **Workflow first, agent second.** Predictable tasks like summarize, extract action items, draft PRD, generate presentation, or tag docs should use tested workflows. Full Agent mode is for open-ended tasks where the exact steps are unknown.
2. **Use multiple model classes.** Treat Gemini Flash / Haiku-like models as fast routers and generators, Sonnet-class models as the default high-quality worker, and Opus/Pro models as opt-in for hard planning and multi-step reasoning.
3. **Stream useful state, not just text.** The user should see that the AI is searching docs, reading a source, editing a section, or waiting on a tool. A spinner alone is not enough.
4. **Ground answers in workspace evidence.** When the answer uses docs, Gmail, Calendar, GitHub, or web search, the response should show inspectable sources.
5. **Structured outputs must be validated.** Any prompt that expects JSON, NDJSON, code, regex, tags, or tool arguments needs a parser or forced schema path plus tests.
6. **Prompt changes need evals.** Do not tune important prompts by eyeballing one or two examples. Add a small dataset and objective graders first.
7. **Permissions are UX, not hidden config.** Read/Edit/Agent must clearly map to allowed tools and show when a write tool actually changed something.
8. **Interceptors over rewrites.** Add identity, memory, permission, verification, and cache layers around the existing chat path before changing endpoint contracts.
9. **Security filters before retrieval.** Post-filtering is fallback defense, not the target architecture.
10. **Verification starts in shadow mode.** Do not delay every streamed answer until evals prove the verifier is worth the latency.

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

- Use `docHybridSearch` by default for workspace-grounded questions; it combines exact keyword search and semantic search before returning sources to the model.
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

### R8. Runtime Identity Context

- Each chat turn may receive a safe, structured identity context containing user id, display name, workspace role, locale/timezone, and workspace/project hints.
- Sensitive directory attributes must be allowlisted. Do not inject raw employee records into prompts.
- Identity context should be represented as prompt params, not string-concatenated into user messages.
- Missing identity context must degrade to the current behavior.

### R9. Multi-Tier Memory

- Short-term scratchpad stores ephemeral tool execution state by session with a TTL.
- Long-term episodic memory remains summarized and user-visible through existing memory UI patterns.
- Users must be able to forget or edit durable preference memories.
- Shared knowledge from docs, directories, and integrations must remain evidence, not personal memory.
- Nightly or 24-hour distillation is preferred over writing granular chat facts on every turn.

### R10. GraphRAG Routing

- Org-chart and project-relationship questions should route to graph/directory tools when available.
- Vector search remains the fallback for unstructured document content.
- Graph answers must cite relationship source records, not just graph traversal output.

### R11. Permission-Aware Retrieval

- Retrieval tools must accept an authorized resource allowlist before search.
- Vector and keyword search APIs should physically constrain candidates by `workspaceId` and authorized `docId`s.
- Post-retrieval `AccessController` checks remain as defense in depth.
- Tests must prove unauthorized docs are not passed to the search backend.

### R12. Self-Correction and Confidence

- A secondary verifier may grade final answers against raw retrieved chunks.
- Low-confidence answers should state exact missing evidence instead of adding generic disclaimers.
- The sycophancy guard should preserve correct facts when the user challenges them without evidence.
- Confidence checks must not consume hidden chain-of-thought. Use final answer, tool traces, retrieved chunks, and optional model-provided concise rationale metadata.

## Data Model Notes

No new database table is required for the first implementation slice.

Useful in-memory / persisted shapes:

- `StreamObject`: extend with optional source/progress metadata only after backend and frontend schemas are updated together.
- `HybridSearchResult`: backend tool result shape for fused workspace sources. It carries `matchedBy`, `score`, `rank`, `snippet`, and a `citation` object for document or attachment footnotes without adding a database table.
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
- User has no directory profile: omit identity context and continue.
- User is allowed to read workspace but not a specific doc: retrieval backend must not receive that doc id.
- Verifier disagrees with model but lacks enough evidence: surface uncertainty, not a fabricated correction.
- Prompt cache prefix changes because workspace policy changed: cache miss is acceptable; stale policy context is not.

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

- Intended behavior: Workspace answers use `docHybridSearch` to run keyword + semantic retrieval, merge with RRF, optionally rerank, and expose source links in the assistant message.
- Implementation status: first slice shipped in `doc-hybrid-search.ts`, including prompt config, Read-mode defaults, stream rendering, and deterministic merge tests.
- Verification status: first shadow verifier slice shipped in `grounding-verifier.ts`, covering missing inline citations, missing reference lists, invalid reference JSON, and unsupported doc/attachment citations.
- Test names:
  - `doc retrieval > given exact term > then keyword result outranks semantic-only result`
  - `doc retrieval > given paraphrase > then semantic result is retained`
  - `doc retrieval > given overlapping candidates > then reciprocal rank fusion deduplicates`
  - `assistant message > given doc citations > then renders source chips`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/tools/doc-keyword-search.ts`
  - `packages/backend/server/src/plugins/copilot/tools/doc-semantic-search.ts`
  - `packages/backend/server/src/plugins/copilot/tools/doc-hybrid-search.ts`
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

### T10 - Chat Request Interceptor Service

- Intended behavior: Identity, memory, retrieval hints, and provider options are assembled in one non-destructive wrapper before provider calls.
- Implementation status: first memory slice is live in the interceptor. It
  injects memories by default, honors `toolsConfig.memory=false`, and preserves
  messages/params on failures.
- Test names:
  - `chat request interceptor > given missing identity context > then returns original prompt params`
  - `chat request interceptor > given workspace user > then injects allowlisted identity params`
  - `chat request interceptor > given disabled feature flag > then leaves final messages unchanged`
  - `ChatRequestInterceptorService.intercept__given_memory_enabled_and_query__then_injects_relevant_memories`
  - `ChatRequestInterceptorService.intercept__given_memory_opt_out__then_preserves_messages_without_retrieval`
  - `ChatRequestInterceptorService.intercept__given_memory_injection_failure__then_returns_original_request`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/controller.ts`
  - new `packages/backend/server/src/plugins/copilot/interceptor/`
  - `packages/backend/server/src/plugins/copilot/index.ts`
- R-tier: R2
- Rollback: disable interceptor flag or remove provider registration; existing chat path remains.

### T11 - Pre-Retrieval Authorization Filter

- Intended behavior: Keyword and semantic retrieval receive a hard authorized-doc allowlist before touching index/vector search.
- Test names:
  - `authorized retrieval filter > given user without doc access > then excludes doc id before search`
  - `doc semantic search > given authorized ids > then passes ids to context matcher`
  - `doc keyword search > given authorized ids > then passes ids to indexer search`
  - `doc retrieval > given post-filter fallback > then still removes unreadable docs`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/tools/doc-keyword-search.ts`
  - `packages/backend/server/src/plugins/copilot/tools/doc-semantic-search.ts`
  - `packages/backend/server/src/plugins/copilot/context/service.ts`
  - indexer service search API if it lacks doc-id filters
  - new `packages/backend/server/src/plugins/copilot/security/`
- R-tier: R1 because this touches authorization semantics.
- Rollback: feature-flag pre-filter and retain existing post-filter checks.

### T12 - Response Verification Shadow Mode

- Intended behavior: Completed workspace-grounded answers are scored against retrieved chunks without blocking the stream.
- Test names:
  - `response verifier > given supported claim > then marks claim verified`
  - `response verifier > given unsupported claim > then returns correction candidate`
  - `response verifier > shadow mode > then does not mutate user-visible assistant content`
  - `response verifier > verifier failure > then chat save still succeeds`
- Affected files:
  - new `packages/backend/server/src/plugins/copilot/verification/`
  - `packages/backend/server/src/plugins/copilot/controller.ts`
  - `packages/backend/server/src/plugins/copilot/providers/types.ts`
- R-tier: R2 in shadow mode; R1 when corrections become user-visible.
- Rollback: disable verifier config; no chat contract change.

### T13 - Confidence and Sycophancy Guard

- Intended behavior: The assistant states uncertainty when evidence is weak and does not accept false corrections just to agree with the user.
- Test names:
  - `confidence evaluator > given missing evidence > then returns low confidence with gap`
  - `sycophancy guard > given user challenges correct cited fact > then preserves cited fact`
  - `mode addendum > given factual conflict > then prioritizes evidence over agreement`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/prompt/mode-addendum.ts`
  - new `packages/backend/server/src/plugins/copilot/verification/`
  - prompt eval fixtures
- R-tier: R2 for prompt/eval changes; R1 if it blocks answers.
- Rollback: revert addendum/evaluator wiring; existing model behavior returns.

### T14 - Memory Tier Hardening

- Intended behavior: Short-term scratchpad, durable memory, and shared knowledge have explicit lifetimes and user controls.
- Implementation status: chat-turn memory retrieval is wired with an explicit
  request-level opt-out. Scratchpad TTL and richer frontend memory preferences
  remain future slices.
- Test names:
  - `chat scratchpad > given session ttl expiry > then drops tool state`
  - `memory preferences > given forget request > then excludes memory from retrieval`
  - `memory retrieval > given shared knowledge > then does not write personal memory`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/memory/`
  - `packages/backend/server/src/plugins/copilot/ws/memory-push.service.ts`
  - frontend memory settings surfaces
- R-tier: R2 unless a migration is required; migrations are R1.
- Rollback: disable scratchpad/memory preference feature flag; existing memory retrieval remains.

### T15 - Prompt Cache and Provider Prefix Discipline

- Intended behavior: Stable provider prefixes maximize cache hits without caching private dynamic content incorrectly.
- Implementation status: `planPromptCache` now marks stable Anthropic prefixes
  as eligible, refuses retrieved private context, and returns disabled plans
  for unsupported providers. Provider request builders still omit cache
  metadata.
- Test names:
  - `prompt cache planner > given stable system prompt > then marks cacheable prefix`
  - `prompt cache planner > given retrieved private doc > then refuses cache marker`
  - `anthropic request builder > given cache unsupported provider > then omits cache metadata`
- Affected files:
  - `packages/backend/server/src/plugins/copilot/providers/anthropic/`
  - `packages/backend/server/src/plugins/copilot/providers/native.ts`
  - `packages/backend/server/src/plugins/copilot/providers/provider-middleware.ts`
- R-tier: R2
- Rollback: remove cache metadata; provider requests still work.

### T16 - Optional vLLM Deployment Notes

- Intended behavior: If Manut later adds self-hosted open-source model nodes, suffix/speculative decoding settings are documented without affecting Vertex production traffic.
- Test names:
  - docs only: `git diff --check`
- Affected files:
  - deployment docs only until a vLLM runtime exists
- R-tier: R2 docs; R1 once serving infrastructure changes.
- Rollback: revert docs/config.

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

Start with T10 + T11 in shadow/non-enforcing mode, then T1 + T2 + a small part of T4:

1. Add `ChatRequestInterceptorService` as a no-op wrapper and prove it preserves existing messages.
2. Add `AuthorizedRetrievalFilterService` tests that expose the current pre-filter gap before changing search behavior.
3. Add eval fixtures and a runner for chat modes.
4. Tighten Read/Edit/Agent addenda and verify with evals.
5. Render existing `tool-call` / `tool-result` stream objects as readable status chips without changing backend event schemas.

This gives us a safe interceptor foundation first, then visible UX gains. Hybrid retrieval, citations, response verification, and provider caching should follow once the eval loop and authorization tests are in place.
