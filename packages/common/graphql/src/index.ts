export * from './fetcher';
export * from './graphql';
// M2 — E2.2 — manual stand-in until codegen regenerates index.ts /
// schema.ts from packages/common/graphql/src/graphql/memory/*.gql.
// Safe to ship before codegen because the exports below are a
// superset-compatible shape; once codegen runs, identical exports
// land in index.ts and this re-export becomes redundant (TS will
// dedupe at the package boundary — runtime objects have identical
// `id`/`op`/`query` so SWR keys stay stable).
export * from './graphql/memory';
// M2 — E2.4 — manual re-export for the self-evolution rateMessage
// mutation, same rationale as the memory exports above. Once codegen
// runs over `copilot-rate-message.gql` the symbol will collide-and-
// dedupe with the version in `graphql/index.ts`.
export * from './graphql/feedback';
export * from './schema';
