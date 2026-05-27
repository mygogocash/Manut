# AI Chat Transport Regression Spec

## Goal

Manut AI chat must render assistant responses even when a browser has the
`ws_transport` flag enabled from an earlier canary. The existing SSE endpoint is
the production response stream until the WebSocket gateway can start provider
generation itself.

## Scope In

- `packages/frontend/core/src/blocksuite/ai/provider/request.ts`
- `packages/frontend/core/src/blocksuite/ai/provider/request.spec.ts`

## Scope Out

- Implementing provider invocation over `/copilot-chat`.
- Changing Copilot model selection, RAG behavior, citations, or prompt content.
- Changing Cloud Run, Vertex, or Resend configuration.

## Intended Behavior

When the user sends a chat prompt, the frontend creates the message and opens
the SSE stream endpoint for the assistant response. A stale `ws_transport` flag
must not reroute the primary response to a WebSocket room subscription that does
not start generation.

## Test

- `AI chat transport > given stale ws_transport flag > uses SSE response stream`

## Affected Files

- `request.ts`: keep SSE as the primary answer stream; reserve WebSocket for a
  future explicit response-stream opt-in.
- `request.spec.ts`: prove the stale flag no longer hijacks the response path.

## Risk Tier

R2 for code: the change is frontend-only and restores the already-working SSE
path. R1 for production deploy because it changes the public live service.

## Rollback

Redeploy the previous known-good Cloud Run image:

```bash
gcloud run services update manut \
  --project affine-495114 \
  --region asia-southeast1 \
  --image asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:main-401ede57d-26513416988
```
