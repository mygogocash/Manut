# Mongo Ingestion 500 Spec

## Requirement

Opening a Manut workspace must not crash with a 500 error when the MongoDB analytics connector is enabled in the schema but the runtime driver or workspace connection is unavailable.

## Observed Failure

Production Railway logs showed GraphQL `internal_server_error` from `MongoIngestionConfigResolver.listMongoCollections`.

The thrown error was: `MongoDB driver is not installed on the server. Ask an admin to add the mongodb package to @affine/server.`

## Intended Behavior

- `@affine/server` includes the MongoDB Node driver so configured Mongo connections can be explored in production.
- `listMongoCollections` is a read-side UI query and must degrade to saved ingestion-config rows, or an empty list, if live schema exploration is unavailable.
- `sampleMongoCollection` must return an empty sample instead of crashing the app shell when live Mongo access is unavailable.
- Mutations still require normal workspace permissions and persist/delete configuration rows normally.

## Edge Cases

- Driver missing or import failure: no GraphQL 500.
- No saved MongoDB connection: no GraphQL 500.
- Saved config rows exist but live exploration fails: return those saved rows so the UI can still render state.
- Connection string credentials must never be logged or returned.

## Testing Strategy

- `Mongo ingestion config > given missing driver > then list returns saved configs instead of throwing`
- `Mongo ingestion config > given missing driver > then sample returns empty documents instead of throwing`
- Existing driver-backed behavior remains covered by the service contracts.

Risk: R2. The patch narrows read-query error handling and adds the runtime dependency required by the existing Mongo connector code path.

Rollback: revert this spec, resolver fallback changes, and the `mongodb` dependency entry/lockfile update.
