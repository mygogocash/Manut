import { Button } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import {
  disconnectPostHogMutation,
  type PostHogConnectionDto,
  postHogConnectionQuery,
  type PostHogConnectionTestResultDto,
  setPostHogConnectionMutation,
  testPostHogConnectionMutation,
} from '../../analytics-connections/graphql';
import { IntegrationSettingHeader } from '../setting';
import { PostHogLogoIcon } from './icons';
import * as styles from './setting-panel.css';

const DEFAULT_HOST = 'https://app.posthog.com';

/**
 * PostHog integration setting panel. API-key + host auth (NOT OAuth).
 *
 * Reuses the GraphQL operations co-located with `analytics-connections`
 * so this card and the analytics-connections panel stay in lockstep.
 *
 * The host defaults to `https://app.posthog.com`; the API key input is
 * `type=password`. A "Test" button hits `/api/projects/` against the
 * candidate credentials before persistence.
 */
export const PostHogSettingPanel = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [apiKey, setApiKey] = useState('');
  const [host, setHost] = useState(DEFAULT_HOST);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const queryArg = {
    query: postHogConnectionQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, mutate } = useQuery(queryArg);
  const connection = (
    data as unknown as { postHogConnection?: PostHogConnectionDto } | undefined
  )?.postHogConnection;
  const isConnected = Boolean(connection?.connected);
  const connectedHost = connection?.host;
  const projectCount = connection?.projectCount;

  const { trigger: triggerSet } = useMutation({
    mutation: setPostHogConnectionMutation,
  });
  const { trigger: triggerTest } = useMutation({
    mutation: testPostHogConnectionMutation,
  });
  const { trigger: triggerDisconnect } = useMutation({
    mutation: disconnectPostHogMutation,
  });

  useEffect(() => {
    if (isConnected) {
      setApiKey('');
      setHost(DEFAULT_HOST);
    }
  }, [isConnected]);

  const handleTest = useCallback(async () => {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      const result = (await (
        triggerTest as (args: unknown) => Promise<unknown>
      )({ input: { apiKey, host } })) as
        | { testPostHogConnection?: PostHogConnectionTestResultDto }
        | undefined;
      const r = result?.testPostHogConnection;
      if (!r) {
        setTestResult({ ok: false, message: 'Test returned no result.' });
        return;
      }
      if (r.ok) {
        const note =
          typeof r.projectCount === 'number'
            ? ` (${r.projectCount} project${r.projectCount === 1 ? '' : 's'} visible)`
            : '';
        setTestResult({
          ok: true,
          message: `Connected to ${r.host ?? host}${note}.`,
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
  }, [triggerTest, apiKey, host]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await (triggerSet as (args: unknown) => Promise<unknown>)({
          workspaceId,
          input: { apiKey, host },
        });
        await mutate();
        setApiKey('');
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not save PostHog connection.'
        );
      } finally {
        setBusy(false);
      }
    },
    [triggerSet, workspaceId, apiKey, host, mutate]
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
        err instanceof Error ? err.message : 'Could not disconnect PostHog.'
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
        icon={<PostHogLogoIcon />}
        name="PostHog"
        desc="Connect a PostHog project to read events, insights, and feature flag data."
        action={action}
      />

      {error ? <div className={styles.errorMessage}>{error}</div> : null}

      {isConnected && connectedHost ? (
        <div className={styles.stateLabel}>
          {`Connected to ${connectedHost}`}
          {typeof projectCount === 'number'
            ? ` · ${projectCount} project${projectCount === 1 ? '' : 's'}`
            : null}
        </div>
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
            <span>Personal API key</span>
            <input
              className={styles.input}
              type="password"
              placeholder="phx_…"
              autoComplete="off"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              value={apiKey}
              onChange={e => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              data-testid="posthog-key-input"
            />
          </label>
          <label className={styles.label}>
            <span>Host</span>
            <input
              className={styles.input}
              type="url"
              placeholder={DEFAULT_HOST}
              autoComplete="off"
              spellCheck={false}
              value={host}
              onChange={e => {
                setHost(e.target.value);
                setTestResult(null);
              }}
              data-testid="posthog-host-input"
            />
          </label>
          <div className={styles.actionsRow}>
            {/* Native <button type="submit"> — AFFiNE Button omits
                `type`. See mongodb/setting-panel.tsx for rationale. */}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={busy || apiKey.length === 0}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <Button
              variant="secondary"
              disabled={busy || apiKey.length === 0}
              onClick={() => void handleTest()}
              data-testid="posthog-test-button"
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
        The API key is encrypted at rest and never logged. Live ingest is
        rolling out soon — for now you can verify the credentials work via the
        Test button.
      </p>
    </div>
  );
};
