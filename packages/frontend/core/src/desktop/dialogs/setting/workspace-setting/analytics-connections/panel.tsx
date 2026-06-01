/**
 * Manut Analytics — Connections panel.
 *
 * Single panel that lists all 8 connectors built in the Wave 7+ batch:
 *   - 5 OAuth social platforms (Facebook, Instagram, Threads, TikTok,
 *     LINE VOOM) — Connect button opens the consent URL in a popup
 *   - 1 internal API-key social (GoGoCash) — Connect opens an inline
 *     form with an API key input
 *   - 2 database connectors (MongoDB, PostHog) — Connect opens an
 *     inline form with connection-string / api-key + host inputs + a
 *     Test button that runs a stateless probe before persistence
 *
 * Each card is graceful-no-op when its env vars are unset on the
 * backend: the resolver throws a typed `*NotConfiguredError`, the
 * frontend renders an empty-state with the env vars the admin needs
 * to provide. No blank popups, no infinite spinners.
 *
 * Mirror of the v1.13.x GitHub OAuth scaffold UX pattern. See
 * `integration/github/setting-panel.tsx` for the canonical
 * single-card implementation we lifted patterns from.
 */
import { Button } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { looksLikeNotConfigured } from '../integration/_shared/error-classifier';
import { FacebookLogoIcon } from '../integration/facebook/icons';
import { GoGoCashLogoIcon } from '../integration/gogocash/icons';
import { InstagramLogoIcon } from '../integration/instagram/icons';
import { LineVoomLogoIcon } from '../integration/line-voom/icons';
import { MongoDbLogoIcon } from '../integration/mongodb/icons';
import { PostHogLogoIcon } from '../integration/posthog/icons';
import { ThreadsLogoIcon } from '../integration/threads/icons';
import { TiktokLogoIcon } from '../integration/tiktok/icons';
import {
  connectFacebookMutation,
  connectInstagramMutation,
  connectLineVoomMutation,
  connectThreadsMutation,
  connectTiktokMutation,
  disconnectFacebookMutation,
  disconnectGoGoCashMutation,
  disconnectInstagramMutation,
  disconnectLineVoomMutation,
  disconnectMongoDbMutation,
  disconnectPostHogMutation,
  disconnectThreadsMutation,
  disconnectTiktokMutation,
  type FacebookConnectionDto,
  facebookConnectionQuery,
  type GoGoCashConnectionDto,
  goGoCashConnectionQuery,
  type InstagramConnectionDto,
  instagramConnectionQuery,
  type LineVoomConnectionDto,
  lineVoomConnectionQuery,
  type MongoDbConnectionDto,
  mongoDbConnectionQuery,
  type MongoDbConnectionTestResultDto,
  type PostHogConnectionDto,
  postHogConnectionQuery,
  type PostHogConnectionTestResultDto,
  setGoGoCashConnectionMutation,
  setMongoDbConnectionMutation,
  setPostHogConnectionMutation,
  testMongoDbConnectionMutation,
  testPostHogConnectionMutation,
  type ThreadsConnectionDto,
  threadsConnectionQuery,
  type TiktokConnectionDto,
  tiktokConnectionQuery,
} from './graphql';
import * as styles from './panel.css';

const POSTMESSAGE_TYPES = [
  'affine:facebook-oauth-result',
  'affine:instagram-oauth-result',
  'affine:threads-oauth-result',
  'affine:tiktok-oauth-result',
  'affine:line-voom-oauth-result',
] as const;

type OAuthPostMessageType = (typeof POSTMESSAGE_TYPES)[number];

interface OAuthResultMessage {
  type: OAuthPostMessageType;
  ok: boolean;
  error?: string;
  // The other side-payload keys vary by provider; we only need ok/error
  // for refresh + banner.
}

function isOAuthResultMessage(value: unknown): value is OAuthResultMessage {
  if (typeof value !== 'object' || value === null) return false;
  const t = (value as { type?: unknown }).type;
  return (
    typeof t === 'string' &&
    POSTMESSAGE_TYPES.includes(t as OAuthPostMessageType)
  );
}

// ----------------------------------------------------------------------------
// Card shells
// ----------------------------------------------------------------------------

interface CardShellProps {
  logo: ReactNode;
  name: string;
  connected: boolean;
  connectedLabel?: string | null;
  description: string;
  busy?: boolean;
  action: ReactNode;
  body?: ReactNode;
  footerNote?: ReactNode;
}

const CardShell = ({
  logo,
  name,
  connected,
  connectedLabel,
  description,
  busy,
  action,
  body,
  footerNote,
}: CardShellProps) => {
  return (
    <article
      className={styles.card}
      data-connected={connected ? 'true' : 'false'}
      data-busy={busy ? 'true' : 'false'}
      data-testid={`analytics-connection-card-${name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <header className={styles.cardHeader}>
        <span className={styles.cardLogo} aria-hidden="true">
          {logo}
        </span>
        <div>
          <h3 className={styles.cardTitle}>{name}</h3>
          {connected && connectedLabel ? (
            <div className={styles.cardSubtitle}>{connectedLabel}</div>
          ) : null}
        </div>
      </header>
      <div className={styles.cardBody}>
        <p className={styles.cardDesc}>{description}</p>
        {body}
      </div>
      <footer className={styles.cardFooter}>
        <span className={styles.badge} data-tone={connected ? 'connected' : ''}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
        {action}
      </footer>
      {footerNote}
    </article>
  );
};

// ----------------------------------------------------------------------------
// OAuth provider card — Facebook / Instagram / Threads / TikTok / LINE VOOM
// ----------------------------------------------------------------------------

interface OAuthCardProps {
  name: string;
  description: string;
  logo: ReactNode;
  // `as unknown` because each provider's query DTO is a different
  // shape. The component only reads `connected` + an optional label
  // — we type the label as a generic string accessor.
  query: { id: string; op: string; query: string };
  connectMutation: { id: string; op: string; query: string };
  disconnectMutation: { id: string; op: string; query: string };
  selectConnectionFromData: (
    data: unknown
  ) => { connected: boolean; label?: string | null } | undefined;
  selectUrlFromMutationResult: (data: unknown) => string | undefined;
  // For the "not configured" empty state.
  envVarsNeeded: string[];
}

const OAuthCard = ({
  name,
  description,
  logo,
  query,
  connectMutation,
  disconnectMutation,
  selectConnectionFromData,
  selectUrlFromMutationResult,
  envVarsNeeded,
}: OAuthCardProps) => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const queryArg = useMemo(
    () =>
      ({
        query,
        variables: { workspaceId },
      }) as unknown as NonNullable<Parameters<typeof useQuery>[0]>,
    [query, workspaceId]
  );
  const { data, mutate } = useQuery(queryArg);
  const connection = selectConnectionFromData(data) ?? {
    connected: false,
    label: undefined,
  };

  const { trigger: triggerConnect } = useMutation({
    mutation: connectMutation,
  });
  const { trigger: triggerDisconnect } = useMutation({
    mutation: disconnectMutation,
  });

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isOAuthResultMessage(event.data)) return;
      if (event.data.ok) {
        setError(null);
        mutate().catch(() => undefined);
      } else {
        setError(
          event.data.error
            ? `${name} connection failed: ${event.data.error}`
            : `${name} connection failed.`
        );
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [mutate, name]);

  const handleConnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await (
        triggerConnect as (args: unknown) => Promise<unknown>
      )({ workspaceId });
      const url = selectUrlFromMutationResult(response);
      if (!url) {
        setNotConfigured(true);
        return;
      }
      const popup = window.open(
        url,
        '_blank',
        'popup=yes,width=600,height=720,noopener=no'
      );
      if (!popup) {
        window.location.href = url;
      }
    } catch (err) {
      if (looksLikeNotConfigured(err, envVarsNeeded)) {
        setNotConfigured(true);
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : `Could not start the ${name} OAuth flow.`
      );
    } finally {
      setBusy(false);
    }
  }, [
    triggerConnect,
    workspaceId,
    selectUrlFromMutationResult,
    envVarsNeeded,
    name,
  ]);

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
        err instanceof Error ? err.message : `Could not disconnect ${name}.`
      );
    } finally {
      setBusy(false);
    }
  }, [triggerDisconnect, workspaceId, mutate, name]);

  const action = notConfigured ? null : connection.connected ? (
    <Button
      variant="error"
      loading={busy}
      disabled={busy}
      onClick={() => void handleDisconnect()}
    >
      Disconnect
    </Button>
  ) : (
    <button
      type="button"
      className={`${styles.button} ${styles.buttonPrimary}`}
      disabled={busy}
      onClick={() => void handleConnect()}
    >
      {busy ? 'Connecting…' : 'Connect'}
    </button>
  );

  return (
    <CardShell
      logo={logo}
      name={name}
      connected={connection.connected}
      connectedLabel={connection.label ?? undefined}
      description={description}
      busy={busy}
      action={action}
      body={
        <>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}
          {notConfigured ? (
            <div
              className={styles.notConfiguredPlate}
              data-testid={`analytics-not-configured-${name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className={styles.notConfiguredTitle}>
                {name} OAuth not configured
              </div>
              <div className={styles.notConfiguredCopy}>
                An admin needs to set{' '}
                {envVarsNeeded.map((envVar, idx) => (
                  <span key={envVar}>
                    <span className={styles.notConfiguredEnv}>{envVar}</span>
                    {idx < envVarsNeeded.length - 1 ? ' and ' : ''}
                  </span>
                ))}{' '}
                in the server config to enable this connector.
              </div>
            </div>
          ) : null}
        </>
      }
    />
  );
};

// ----------------------------------------------------------------------------
// API-key + inline-form card — GoGoCash / MongoDB / PostHog
// ----------------------------------------------------------------------------

interface InlineFormCardProps {
  name: string;
  description: string;
  logo: ReactNode;
  query: { id: string; op: string; query: string };
  setMutation: { id: string; op: string; query: string };
  testMutation?: { id: string; op: string; query: string };
  disconnectMutation: { id: string; op: string; query: string };
  selectConnectionFromData: (
    data: unknown
  ) => { connected: boolean; label?: string | null } | undefined;
  selectStatusFromSetResult: (data: unknown) =>
    | {
        connected: boolean;
        label?: string | null;
      }
    | undefined;
  selectTestResult?: (data: unknown) =>
    | {
        ok: boolean;
        error?: string | null;
        label?: string | null;
      }
    | undefined;
  inputs: Array<{
    key: string;
    label: string;
    placeholder: string;
    secret: boolean;
    autoComplete?: string;
    defaultValue?: string;
  }>;
  /**
   * Builds the variables shape for `setMutation` / `testMutation` from
   * the form's current values. Different connectors have different
   * input types — GoGoCash has only `apiKey`, MongoDB has `uri`,
   * PostHog has `apiKey + host`.
   */
  buildInput: (values: Record<string, string>) => unknown;
}

const InlineFormCard = ({
  name,
  description,
  logo,
  query,
  setMutation,
  testMutation,
  disconnectMutation,
  selectConnectionFromData,
  selectStatusFromSetResult,
  selectTestResult,
  inputs,
  buildInput,
}: InlineFormCardProps) => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    inputs.forEach(i => {
      initial[i.key] = i.defaultValue ?? '';
    });
    return initial;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const queryArg = useMemo(
    () =>
      ({
        query,
        variables: { workspaceId },
      }) as unknown as NonNullable<Parameters<typeof useQuery>[0]>,
    [query, workspaceId]
  );
  const { data, mutate } = useQuery(queryArg);
  const connection = selectConnectionFromData(data) ?? {
    connected: false,
    label: undefined,
  };

  const { trigger: triggerSet } = useMutation({ mutation: setMutation });
  const { trigger: triggerDisconnect } = useMutation({
    mutation: disconnectMutation,
  });
  const { trigger: triggerTest } = useMutation({
    // Type-only fallback when no test mutation provided. The wrapped
    // call is gated by `testMutation` truthiness before invocation.
    mutation:
      testMutation ??
      (setMutation as { id: string; op: string; query: string }),
  });

  const handleChange = useCallback(
    (key: string) => (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValues(prev => ({ ...prev, [key]: v }));
      setTestResult(null);
      setError(null);
    },
    []
  );

  const handleTest = useCallback(async () => {
    if (!testMutation || !selectTestResult) return;
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      const result = await (triggerTest as (args: unknown) => Promise<unknown>)(
        { input: buildInput(values) }
      );
      const parsed = selectTestResult(result);
      if (!parsed) {
        setTestResult({
          ok: false,
          message: 'Connection test returned no result.',
        });
        return;
      }
      if (parsed.ok) {
        setTestResult({
          ok: true,
          message: parsed.label
            ? `Connected to ${parsed.label}.`
            : 'Connection looks healthy.',
        });
      } else {
        setTestResult({
          ok: false,
          message: parsed.error ?? 'Connection test failed.',
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection test failed.',
      });
    } finally {
      setBusy(false);
    }
  }, [testMutation, selectTestResult, triggerTest, buildInput, values]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const response = await (
          triggerSet as (args: unknown) => Promise<unknown>
        )({ workspaceId, input: buildInput(values) });
        const parsed = selectStatusFromSetResult(response);
        if (!parsed?.connected) {
          setError(`Save failed for ${name}.`);
          return;
        }
        await mutate();
        // Clear all secret inputs after save — the API key has been
        // persisted (encrypted) and shouldn't sit in the form value
        // longer than necessary.
        setValues(prev => {
          const next = { ...prev };
          inputs.forEach(i => {
            if (i.secret) next[i.key] = '';
          });
          return next;
        });
        setFormOpen(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `Could not save ${name} connection.`
        );
      } finally {
        setBusy(false);
      }
    },
    [
      triggerSet,
      workspaceId,
      buildInput,
      values,
      selectStatusFromSetResult,
      name,
      mutate,
      inputs,
    ]
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
        err instanceof Error ? err.message : `Could not disconnect ${name}.`
      );
    } finally {
      setBusy(false);
    }
  }, [triggerDisconnect, workspaceId, mutate, name]);

  const action = connection.connected ? (
    <Button
      variant="error"
      loading={busy}
      disabled={busy}
      onClick={() => void handleDisconnect()}
    >
      Disconnect
    </Button>
  ) : (
    <button
      type="button"
      className={`${styles.button} ${styles.buttonPrimary}`}
      disabled={busy}
      onClick={() => setFormOpen(open => !open)}
    >
      {formOpen ? 'Cancel' : 'Connect'}
    </button>
  );

  return (
    <CardShell
      logo={logo}
      name={name}
      connected={connection.connected}
      connectedLabel={connection.label ?? undefined}
      description={description}
      busy={busy}
      action={action}
      body={
        <>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}
          {formOpen && !connection.connected ? (
            <form
              className={styles.inlineForm}
              onSubmit={e => {
                handleSubmit(e).catch(() => {
                  /* errors already captured into local state */
                });
              }}
            >
              {inputs.map(input => (
                <label key={input.key} className={styles.inlineLabel}>
                  <span>{input.label}</span>
                  <input
                    className={styles.inlineInput}
                    type={input.secret ? 'password' : 'text'}
                    placeholder={input.placeholder}
                    autoComplete={input.autoComplete ?? 'off'}
                    value={values[input.key] ?? ''}
                    onChange={handleChange(input.key)}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    data-testid={`analytics-connection-input-${name.toLowerCase()}-${input.key}`}
                  />
                </label>
              ))}
              <div className={styles.inlineActions}>
                <button
                  type="submit"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  disabled={busy}
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
                {testMutation ? (
                  <button
                    type="button"
                    className={styles.button}
                    disabled={busy}
                    onClick={() => void handleTest()}
                    data-testid={`analytics-connection-test-${name.toLowerCase()}`}
                  >
                    Test
                  </button>
                ) : null}
              </div>
              {testResult ? (
                testResult.ok ? (
                  <div className={styles.successText}>{testResult.message}</div>
                ) : (
                  <div className={styles.errorBanner}>{testResult.message}</div>
                )
              ) : null}
            </form>
          ) : null}
        </>
      }
    />
  );
};

// ----------------------------------------------------------------------------
// Provider logo plates — each platform's real brand glyph painted on a
// rounded brand-coloured plate. The plate fills the parent `cardLogo`
// (32×32) and the SVG is centered inside at 20×20 so the brand mark
// reads cleanly without crowding the plate edge.
//
// Each glyph is imported from the per-platform `integration/<name>/icons.tsx`
// — the same component used by the standalone integration setting-panel
// headers. That keeps the brand mark consistent across both surfaces and
// gives us a single point of edit per platform.
// ----------------------------------------------------------------------------

const BrandPlate = ({
  glyph,
  bg,
  glyphColor = '#fff',
}: {
  glyph: ReactNode;
  bg: string;
  glyphColor?: string;
}) => (
  <span
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      background: bg,
      color: glyphColor,
    }}
  >
    <span
      style={{
        width: 20,
        height: 20,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {glyph}
    </span>
  </span>
);

// ----------------------------------------------------------------------------
// Selectors — keep DTO unwrapping in one spot per provider
// ----------------------------------------------------------------------------

const facebookSelectors = {
  conn: (data: unknown) => {
    const conn = (
      data as { facebookConnection?: FacebookConnectionDto } | undefined
    )?.facebookConnection;
    if (!conn) return undefined;
    return { connected: conn.connected, label: conn.displayName };
  },
  url: (data: unknown) =>
    (data as { connectFacebook?: { url?: string } } | undefined)
      ?.connectFacebook?.url,
};

const instagramSelectors = {
  conn: (data: unknown) => {
    const conn = (
      data as { instagramConnection?: InstagramConnectionDto } | undefined
    )?.instagramConnection;
    if (!conn) return undefined;
    return {
      connected: conn.connected,
      label: conn.username ? `@${conn.username}` : undefined,
    };
  },
  url: (data: unknown) =>
    (data as { connectInstagram?: { url?: string } } | undefined)
      ?.connectInstagram?.url,
};

const threadsSelectors = {
  conn: (data: unknown) => {
    const conn = (
      data as { threadsConnection?: ThreadsConnectionDto } | undefined
    )?.threadsConnection;
    if (!conn) return undefined;
    return {
      connected: conn.connected,
      label: conn.username ? `@${conn.username}` : undefined,
    };
  },
  url: (data: unknown) =>
    (data as { connectThreads?: { url?: string } } | undefined)?.connectThreads
      ?.url,
};

const tiktokSelectors = {
  conn: (data: unknown) => {
    const conn = (
      data as { tiktokConnection?: TiktokConnectionDto } | undefined
    )?.tiktokConnection;
    if (!conn) return undefined;
    return { connected: conn.connected, label: conn.displayName };
  },
  url: (data: unknown) =>
    (data as { connectTiktok?: { url?: string } } | undefined)?.connectTiktok
      ?.url,
};

const lineVoomSelectors = {
  conn: (data: unknown) => {
    const conn = (
      data as { lineVoomConnection?: LineVoomConnectionDto } | undefined
    )?.lineVoomConnection;
    if (!conn) return undefined;
    return { connected: conn.connected, label: conn.displayName };
  },
  url: (data: unknown) =>
    (data as { connectLineVoom?: { url?: string } } | undefined)
      ?.connectLineVoom?.url,
};

const goGoCashSelectors = {
  conn: (data: unknown) => {
    const conn = (
      data as { goGoCashConnection?: GoGoCashConnectionDto } | undefined
    )?.goGoCashConnection;
    if (!conn) return undefined;
    return { connected: conn.connected, label: conn.label };
  },
  setResult: (data: unknown) => {
    const conn = (
      data as { setGoGoCashConnection?: GoGoCashConnectionDto } | undefined
    )?.setGoGoCashConnection;
    if (!conn) return undefined;
    return { connected: conn.connected, label: conn.label };
  },
};

const mongoSelectors = {
  conn: (data: unknown) => {
    const conn = (
      data as { mongoDbConnection?: MongoDbConnectionDto } | undefined
    )?.mongoDbConnection;
    if (!conn) return undefined;
    return { connected: conn.connected, label: conn.host };
  },
  setResult: (data: unknown) => {
    const conn = (
      data as { setMongoDbConnection?: MongoDbConnectionDto } | undefined
    )?.setMongoDbConnection;
    if (!conn) return undefined;
    return { connected: conn.connected, label: conn.host };
  },
  testResult: (data: unknown) => {
    const t = (
      data as
        | { testMongoDbConnection?: MongoDbConnectionTestResultDto }
        | undefined
    )?.testMongoDbConnection;
    if (!t) return undefined;
    return { ok: t.ok, error: t.error, label: t.host };
  },
};

const postHogSelectors = {
  conn: (data: unknown) => {
    const conn = (
      data as { postHogConnection?: PostHogConnectionDto } | undefined
    )?.postHogConnection;
    if (!conn) return undefined;
    // `projectCount` is not persisted by the backend (always undefined), so
    // the previous `(N projects)` suffix never rendered and was misleading.
    // Drop it — show only the host. If the backend starts persisting a
    // project count, re-add a verified suffix here.
    return {
      connected: conn.connected,
      label: conn.host ? conn.host : undefined,
    };
  },
  setResult: (data: unknown) => {
    const conn = (
      data as { setPostHogConnection?: PostHogConnectionDto } | undefined
    )?.setPostHogConnection;
    if (!conn) return undefined;
    return { connected: conn.connected, label: conn.host };
  },
  testResult: (data: unknown) => {
    const t = (
      data as
        | { testPostHogConnection?: PostHogConnectionTestResultDto }
        | undefined
    )?.testPostHogConnection;
    if (!t) return undefined;
    return { ok: t.ok, error: t.error, label: t.host };
  },
};

// ----------------------------------------------------------------------------
// Panel
// ----------------------------------------------------------------------------

export const AnalyticsConnectionsPanel = () => {
  return (
    <div className={styles.root} data-testid="analytics-connections-panel">
      <p className={styles.subtitle}>
        Link your workspace&apos;s social accounts to start collecting metrics.
      </p>
      <div className={styles.list}>
        <OAuthCard
          name="Facebook"
          description="Connect a Facebook account to import Page engagement metrics."
          logo={
            <BrandPlate
              glyph={<FacebookLogoIcon width={20} height={20} />}
              bg="#0866FF"
            />
          }
          query={facebookConnectionQuery}
          connectMutation={connectFacebookMutation}
          disconnectMutation={disconnectFacebookMutation}
          selectConnectionFromData={facebookSelectors.conn}
          selectUrlFromMutationResult={facebookSelectors.url}
          envVarsNeeded={['FB_OAUTH_CLIENT_ID', 'FB_OAUTH_CLIENT_SECRET']}
        />
        <OAuthCard
          name="Instagram"
          description="Connect Instagram (Basic Display) to import profile + media stats."
          logo={
            <BrandPlate
              glyph={<InstagramLogoIcon width={20} height={20} />}
              bg="#E4405F"
            />
          }
          query={instagramConnectionQuery}
          connectMutation={connectInstagramMutation}
          disconnectMutation={disconnectInstagramMutation}
          selectConnectionFromData={instagramSelectors.conn}
          selectUrlFromMutationResult={instagramSelectors.url}
          envVarsNeeded={['IG_OAUTH_CLIENT_ID', 'IG_OAUTH_CLIENT_SECRET']}
        />
        <OAuthCard
          name="Threads"
          description="Connect a Threads account to import post engagement data."
          logo={
            <BrandPlate
              glyph={<ThreadsLogoIcon width={20} height={20} />}
              bg="#000000"
            />
          }
          query={threadsConnectionQuery}
          connectMutation={connectThreadsMutation}
          disconnectMutation={disconnectThreadsMutation}
          selectConnectionFromData={threadsSelectors.conn}
          selectUrlFromMutationResult={threadsSelectors.url}
          envVarsNeeded={[
            'THREADS_OAUTH_CLIENT_ID',
            'THREADS_OAUTH_CLIENT_SECRET',
          ]}
        />
        <OAuthCard
          name="TikTok"
          description="Connect a TikTok account to import video performance metrics."
          logo={
            <BrandPlate
              glyph={<TiktokLogoIcon width={20} height={20} />}
              bg="#000000"
            />
          }
          query={tiktokConnectionQuery}
          connectMutation={connectTiktokMutation}
          disconnectMutation={disconnectTiktokMutation}
          selectConnectionFromData={tiktokSelectors.conn}
          selectUrlFromMutationResult={tiktokSelectors.url}
          envVarsNeeded={[
            'TIKTOK_OAUTH_CLIENT_ID',
            'TIKTOK_OAUTH_CLIENT_SECRET',
          ]}
        />
        <OAuthCard
          name="LINE VOOM"
          description="Connect a LINE account to surface VOOM profile + post analytics."
          logo={
            <BrandPlate
              glyph={<LineVoomLogoIcon width={20} height={20} />}
              bg="#06C755"
            />
          }
          query={lineVoomConnectionQuery}
          connectMutation={connectLineVoomMutation}
          disconnectMutation={disconnectLineVoomMutation}
          selectConnectionFromData={lineVoomSelectors.conn}
          selectUrlFromMutationResult={lineVoomSelectors.url}
          envVarsNeeded={['LINE_OAUTH_CLIENT_ID', 'LINE_OAUTH_CLIENT_SECRET']}
        />
        <InlineFormCard
          name="GoGoCash"
          description="Paste a GoGoCash internal API key to push analytics from the in-house platform."
          logo={
            <BrandPlate
              glyph={<GoGoCashLogoIcon width={20} height={20} />}
              bg="#7C3AED"
            />
          }
          query={goGoCashConnectionQuery}
          setMutation={setGoGoCashConnectionMutation}
          disconnectMutation={disconnectGoGoCashMutation}
          selectConnectionFromData={goGoCashSelectors.conn}
          selectStatusFromSetResult={goGoCashSelectors.setResult}
          inputs={[
            {
              key: 'apiKey',
              label: 'API key',
              placeholder: 'gogo_live_…',
              secret: true,
            },
            {
              key: 'label',
              label: 'Label (optional)',
              placeholder: 'Production',
              secret: false,
            },
          ]}
          buildInput={values => ({
            apiKey: values.apiKey ?? '',
            label: values.label || undefined,
          })}
        />
        <InlineFormCard
          name="MongoDB"
          description="Connect a MongoDB cluster to query analytics from your own collections."
          logo={
            <BrandPlate
              glyph={<MongoDbLogoIcon width={20} height={20} />}
              bg="#00684A"
            />
          }
          query={mongoDbConnectionQuery}
          setMutation={setMongoDbConnectionMutation}
          testMutation={testMongoDbConnectionMutation}
          disconnectMutation={disconnectMongoDbMutation}
          selectConnectionFromData={mongoSelectors.conn}
          selectStatusFromSetResult={mongoSelectors.setResult}
          selectTestResult={mongoSelectors.testResult}
          inputs={[
            {
              key: 'uri',
              label: 'Connection string',
              placeholder: 'mongodb+srv://user:pass@cluster/db',
              secret: true,
              autoComplete: 'off',
            },
          ]}
          buildInput={values => ({ uri: values.uri ?? '' })}
        />
        <InlineFormCard
          name="PostHog"
          description="Paste a PostHog personal API key to read project events + insights."
          logo={
            <BrandPlate
              glyph={<PostHogLogoIcon width={20} height={20} />}
              bg="#F54E00"
            />
          }
          query={postHogConnectionQuery}
          setMutation={setPostHogConnectionMutation}
          testMutation={testPostHogConnectionMutation}
          disconnectMutation={disconnectPostHogMutation}
          selectConnectionFromData={postHogSelectors.conn}
          selectStatusFromSetResult={postHogSelectors.setResult}
          selectTestResult={postHogSelectors.testResult}
          inputs={[
            {
              key: 'apiKey',
              label: 'Personal API key',
              placeholder: 'phx_…',
              secret: true,
            },
            {
              key: 'host',
              label: 'Host',
              placeholder: 'https://app.posthog.com',
              secret: false,
              defaultValue: 'https://app.posthog.com',
            },
          ]}
          buildInput={values => ({
            apiKey: values.apiKey ?? '',
            host: values.host || undefined,
          })}
        />
      </div>
      <p className={styles.helpText}>
        Connectors are graceful-no-op while live ingestion rolls out — a Connect
        button without an OAuth client configured surfaces the env vars an admin
        needs to set instead of opening a blank popup.
      </p>
    </div>
  );
};
