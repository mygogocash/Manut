---
okf_version: "0.2"
---

# Intranet developer knowledge bundle

Open Knowledge Format v0.2 bundle. Concept identity is the file path minus
`.md`. Cross-links are bundle-absolute (`/pitfalls/express-route-order.md`).

Generated documents carry a `generated` key and are rewritten by
`pnpm okf:generate` — never hand-edit them. Curated documents omit
`generated` and carry `verified` / `stale_after` instead.

## Sections

- [Pitfalls](/pitfalls/index.md) — mistakes this codebase has actually made. Read before editing an unfamiliar module.
- [Patterns](/patterns/index.md) — reusable module shapes. Read before building something that resembles an existing module.

## Conventions

- Reserved filenames: `index.md` (progressive disclosure) and `log.md`
  (chronological history). Neither is ever a concept document.
- `status` is one of `draft`, `stable`, `deprecated`.
- Full design and roadmap: `docs/superpowers/specs/2026-08-17-okf-knowledge-base-design.md`.
