import { Button } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import {
  disconnectMongoDbMutation,
  type MongoDbConnectionDto,
  mongoDbConnectionQuery,
  type MongoDbConnectionTestResultDto,
  setMongoDbConnectionMutation,
  testMongoDbConnectionMutation,
} from '../../analytics-connections/graphql';
import { IntegrationSettingHeader } from '../setting';
import { MongoDbLogoIcon } from './icons';
import * as styles from './setting-panel.css';

/**
 * MongoDB integration setting panel. Direct-URI auth (NOT OAuth).
 *
 * Reuses the same GraphQL operations that drive the
 * `analytics-connections` panel — we co-locate the GQL ops there and
 * import here to keep both surfaces in lockstep.
 *
 * The URI input is `type=password` so it's not surfaced in
 * autocomplete history or screen-share. A "Test" button runs
 * `db.command({ ping: 1 })` against a candidate URI before persistence.
 */
export const MongoDbSettingPanel = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [uri, setUri] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const queryArg = {
    query: mongoDbConnectionQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, mutate } = useQuery(queryArg);
  const connection = (
    data as unknown as { mongoDbConnection?: MongoDbConnectionDto } | undefined
  )?.mongoDbConnection;
  const isConnected = Boolean(connection?.connected);
  const host = connection?.host;

  const { trigger: triggerSet } = useMutation({
    mutation: setMongoDbConnectionMutation,
  });
  const { trigger: triggerTest } = useMutation({
    mutation: testMongoDbConnectionMutation,
  });
  const { trigger: triggerDisconnect } = useMutation({
    mutation: disconnectMongoDbMutation,
  });

  // Clear the in-memory URI when the connection state changes (so it
  // doesn't sit in component state longer than necessary).
  useEffect(() => {
    if (isConnected) setUri('');
  }, [isConnected]);

  const handleTest = useCallback(async () => {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      const result = (await (
        triggerTest as (args: unknown) => Promise<unknown>
      )({ input: { uri } })) as
        | { testMongoDbConnection?: MongoDbConnectionTestResultDto }
        | undefined;
      const r = result?.testMongoDbConnection;
      if (!r) {
        setTestResult({ ok: false, message: 'Test returned no result.' });
        return;
      }
      if (r.ok) {
        const pingNote =
          typeof r.pingMs === 'number' ? ` (${r.pingMs}ms ping)` : '';
        setTestResult({
          ok: true,
          message: `Connected to ${r.host ?? 'cluster'}${pingNote}.`,
        });
      } else {
        setTestResult({ ok: false, message: r.error ?? 'Test failed.' });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Test failed.',
      });
    } finally {
      setBusy(false);
    }
  }, [triggerTest, uri]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await (triggerSet as (args: unknown) => Promise<unknown>)({
          workspaceId,
          input: { uri },
        });
        await mutate();
        setUri('');
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not save MongoDB connection.'
        );
      } finally {
        setBusy(false);
      }
    },
    [triggerSet, workspaceId, uri, mutate]
  );

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await (triggerDisconnect as (args: unknown) => Promise<unknown>)({
        workspaceId,
      });
      await mutate();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not disconnect MongoDB.'
      );
    } finally {
      setBusy(false);
    }
  }, [triggerDisconnect, workspaceId, mutate]);

  const action = isConnected ? (
    <Button
      variant="error"
      loading={busy}
      disabled={busy}
      onClick={() => void handleDisconnect()}
    >
      Disconnect
    </Button>
  ) : null;

  return (
    <div className={styles.root}>
      <IntegrationSettingHeader
        icon={<MongoDbLogoIcon />}
        name="MongoDB"
        desc="Connect a MongoDB cluster to query analytics from your own collections."
        action={action}
      />

      {error ? <div className={styles.errorMessage}>{error}</div> : null}

      {isConnected && host ? (
        <div className={styles.stateLabel}>{`Connected to ${host}`}</div>
      ) : null}

      {!isConnected ? (
        <form
          className={styles.form}
          onSubmit={e => {
            handleSubmit(e).catch(() => {
              /* errors already captured into local state */
            });
          }}
        >
          <label className={styles.label}>
            <span>Connection string</span>
            <input
              className={styles.input}
              type="password"
              placeholder="mongodb+srv://user:pass@cluster/db"
              autoComplete="off"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              value={uri}
              onChange={e => {
                setUri(e.target.value);
                setTestResult(null);
              }}
              data-testid="mongodb-uri-input"
            />
          </label>
          <div className={styles.actionsRow}>
            {/* Native <button type="submit"> here — the AFFiNE Button
                component omits the `type` prop (always defaults to
                button). Using a plain submit button keeps form
                Enter-key submission working without restructuring
                the parent form into a handler-only flow. */}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={busy || uri.length === 0}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <Button
              variant="secondary"
              disabled={busy || uri.length === 0}
              onClick={() => void handleTest()}
              data-testid="mongodb-test-button"
            >
              Test
            </Button>
          </div>
          {testResult ? (
            testResult.ok ? (
              <div className={styles.successText}>{testResult.message}</div>
            ) : (
              <div className={styles.errorMessage}>{testResult.message}</div>
            )
          ) : null}
        </form>
      ) : null}

      <p className={styles.helpText}>
        The connection string is encrypted at rest and never logged. Live ingest
        is rolling out soon — for now you can verify the credentials work via
        the Test button.
      </p>
    </div>
  );
};
