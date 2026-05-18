import { Switch } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  type MnPluginConfigDto,
  mnPluginConfigsQuery,
  type MnPluginDto,
  mnPluginsQuery,
  upsertMnPluginConfigMutation,
} from '@affine/core/modules/manut-control-plane';
import { isGraphQLSchemaValidationError } from '@affine/error';
import { Suspense, useCallback, useMemo, useState } from 'react';

import * as styles from './workspace-plugins.css';

// en-only copy; thread through i18n in the same pass as the rest of the
// control-plane workspace panel.
const PLUGINS_UNAVAILABLE_MESSAGE =
  'Plugins are not enabled on this workspace. Ask your administrator to ' +
  'install plugins from the instance Plugin Manager first.';

function errorBoxMessage(err: unknown): string {
  if (isGraphQLSchemaValidationError(err)) {
    return PLUGINS_UNAVAILABLE_MESSAGE;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

const SkeletonList = () => (
  <div className={styles.skeletonGroup}>
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
  </div>
);

interface WorkspacePluginRow {
  plugin: MnPluginDto;
  config: MnPluginConfigDto;
  enabled: boolean;
}

interface PluginTableProps {
  workspaceId: string;
}

const PluginTable = ({ workspaceId }: PluginTableProps) => {
  const pluginsArg = {
    query: mnPluginsQuery,
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const configsArg = {
    query: mnPluginConfigsQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data: pluginsResp, error: pluginsError } = useQuery(pluginsArg);
  const {
    data: configsResp,
    error: configsError,
    mutate: revalidateConfigs,
  } = useQuery(configsArg);

  const upsertMut = useMutation({
    mutation: upsertMnPluginConfigMutation,
  } as Parameters<typeof useMutation>[0]);
  const trigger = (
    upsertMut as unknown as { trigger: (vars: unknown) => Promise<unknown> }
  ).trigger;
  const upsertIsMutating = (upsertMut as unknown as { isMutating: boolean })
    .isMutating;

  const [optimisticOverride, setOptimisticOverride] = useState<
    Record<string, boolean>
  >({});

  const handleToggle = useCallback(
    async (plugin: MnPluginDto, nextEnabled: boolean) => {
      setOptimisticOverride(prev => ({ ...prev, [plugin.id]: nextEnabled }));
      try {
        await trigger({
          input: {
            workspaceId,
            pluginId: plugin.id,
            configJson: { enabled: nextEnabled },
          },
        });
        if (revalidateConfigs) {
          await (revalidateConfigs as () => Promise<unknown>)();
        }
      } catch (err) {
        // Roll back optimistic state on failure.
        setOptimisticOverride(prev => {
          const next = { ...prev };
          delete next[plugin.id];
          return next;
        });
        // Re-throw so callers' surface boundary handles it; the chrome
        // around the panel renders the error inline.
        throw err;
      }
    },
    [trigger, workspaceId, revalidateConfigs]
  );

  const rows: WorkspacePluginRow[] = useMemo(() => {
    const plugins =
      (pluginsResp as unknown as { mnPlugins?: MnPluginDto[] } | undefined)
        ?.mnPlugins ?? [];
    const configs =
      (
        configsResp as unknown as
          | { mnPluginConfigs?: MnPluginConfigDto[] }
          | undefined
      )?.mnPluginConfigs ?? [];
    const configByPluginId = new Map<string, MnPluginConfigDto>();
    for (const cfg of configs) {
      if (cfg.projectId === null) {
        configByPluginId.set(cfg.pluginId, cfg);
      }
    }
    return plugins.map(plugin => {
      const cfg =
        configByPluginId.get(plugin.id) ??
        // Synthesise: matches the backend's `virtual:<pluginId>` row.
        ({
          id: `virtual:${plugin.id}`,
          pluginId: plugin.id,
          workspaceId,
          projectId: null,
          configJson: { enabled: false },
          createdAt: plugin.installedAt,
          updatedAt: plugin.installedAt,
        } satisfies MnPluginConfigDto);
      const optimistic = optimisticOverride[plugin.id];
      const enabled =
        optimistic !== undefined
          ? optimistic
          : Boolean(cfg.configJson?.enabled);
      return { plugin, config: cfg, enabled };
    });
  }, [pluginsResp, configsResp, workspaceId, optimisticOverride]);

  if (pluginsError) {
    return (
      <div className={styles.errorBox} role="alert">
        Failed to load plugins: {errorBoxMessage(pluginsError)}
      </div>
    );
  }
  if (configsError) {
    return (
      <div className={styles.errorBox} role="alert">
        Failed to load plugin configs: {errorBoxMessage(configsError)}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.muted} data-testid="cp-plugins-empty">
        No plugins are installed on this instance yet. Ask an administrator to
        install plugins via the Plugin Manager.
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: '24%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '32%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.th}>Plugin</th>
            <th className={styles.th}>Version</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Capabilities</th>
            <th className={styles.th}>Workspace</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isLast = index === rows.length - 1;
            const tdClass = isLast
              ? `${styles.td} ${styles.lastRowTd}`
              : styles.td;
            const caps = row.plugin.manifestJson?.capabilities ?? [];
            return (
              <tr
                key={row.plugin.id}
                data-testid="cp-plugin-row"
                data-plugin-id={row.plugin.id}
              >
                <td className={tdClass}>
                  <div className={styles.pluginName}>{row.plugin.name}</div>
                  {row.plugin.packagePath ? (
                    <div className={styles.lastSeenCell}>
                      {row.plugin.packagePath}
                    </div>
                  ) : null}
                </td>
                <td className={`${tdClass} ${styles.slugCell}`}>
                  {row.plugin.version}
                </td>
                <td className={tdClass}>
                  <span
                    className={`${styles.statusPill} ${
                      row.plugin.processStatus === 'RUNNING'
                        ? styles.statusRunning
                        : row.plugin.processStatus === 'CRASHED'
                          ? styles.statusCrashed
                          : styles.statusOther
                    }`}
                  >
                    {row.plugin.processStatus.toLowerCase()}
                  </span>
                </td>
                <td className={tdClass}>
                  {caps.length === 0 ? (
                    <span className={styles.muted}>None declared</span>
                  ) : (
                    <div className={styles.capList}>
                      {caps.map(cap => (
                        <span key={cap} className={styles.capPill}>
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className={`${tdClass} ${styles.toggleCell}`}>
                  <Switch
                    checked={row.enabled}
                    disabled={upsertIsMutating}
                    onChange={(checked: boolean) => {
                      handleToggle(row.plugin, checked).catch(console.error);
                    }}
                    data-testid="cp-plugin-toggle"
                    data-plugin-id={row.plugin.id}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface WorkspacePluginsPanelProps {
  workspaceId: string;
}

export const WorkspacePluginsPanel = ({
  workspaceId,
}: WorkspacePluginsPanelProps) => {
  const fallback = useMemo(() => <SkeletonList />, []);
  return (
    <section className={styles.root} data-testid="cp-plugins-panel">
      <div className={styles.sectionTitle}>Plugins for this workspace</div>
      <div className={styles.muted}>
        Toggle each plugin on or off for this workspace only. Installation and
        instance-wide lifecycle controls live in the instance Plugin Manager
        (admin app).
      </div>
      <Suspense fallback={fallback}>
        <PluginTable workspaceId={workspaceId} />
      </Suspense>
    </section>
  );
};
