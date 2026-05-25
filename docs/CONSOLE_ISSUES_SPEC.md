# Console Issues Cleanup Spec

## Requirement

Production should not emit app-owned console, warning, or server startup issues for the Manut AI model picker and Vertex providers.

The current browser console issues on `https://manut.xyz/` are Cloudflare challenge-platform deprecation notices from `/cdn-cgi/challenge-platform/scripts/jsd/main.js`; those are outside the application bundle. The app-owned issue is the backend startup error from Vertex model refresh parsing Google's HTML 404 response as JSON.

## Intended Behavior

- Vertex model invocation keeps using the project-scoped `v1/projects/{project}/locations/{location}/publishers/{publisher}` base URL.
- Vertex Model Garden publisher listing uses the supported `v1beta1/publishers/{publisher}/models` endpoint.
- If a model-list request returns a non-OK response, non-JSON body, or invalid schema, provider startup quietly keeps the static model list instead of logging an error stack.
- Custom Vertex `baseURL` deployments remain supported.

## Data Models

- `VertexModelListSchema` remains the source of truth for parsed `publisherModels`.
- Publisher model IDs are still normalized from `publishers/{publisher}/models/{id}` plus optional `versionId`.

## Edge Cases

- Missing `location`: no refresh URL is generated.
- Custom `baseURL`: refresh tries `{baseURL}/models` for compatibility, but failures are ignored.
- `403`, `404`, HTML, or malformed JSON: no exception escapes refresh; the static configured models stay available.

## Testing Strategy

- `subject > given project-scoped Vertex config > then model list URL uses publisher v1beta1 endpoint`
- `subject > given custom baseURL > then model list URL preserves custom endpoint`
- `subject > given non-JSON list response > then parser returns undefined`
- `subject > given valid publisher response > then parser returns publisher models`

Risk: R2. This is an internal startup-refresh fallback; model invocation URLs are intentionally unchanged.

Rollback: revert the provider utility and refresh call changes plus this spec/test file.
