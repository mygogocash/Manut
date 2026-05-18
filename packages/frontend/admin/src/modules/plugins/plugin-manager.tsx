import { Badge } from '@affine/admin/components/ui/badge';
import { Button } from '@affine/admin/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@affine/admin/components/ui/card';
import { Input } from '@affine/admin/components/ui/input';
import { Label } from '@affine/admin/components/ui/label';
import { ScrollArea } from '@affine/admin/components/ui/scroll-area';
import { Skeleton } from '@affine/admin/components/ui/skeleton';
import { useMutation } from '@affine/admin/use-mutation';
import { useQuery } from '@affine/admin/use-query';
import {
  disableMnPluginMutation,
  enableMnPluginMutation,
  installMnPluginMutation,
  type MnPluginDto,
  mnPluginsQuery,
  uninstallMnPluginMutation,
} from '@affine/core/modules/manut-control-plane';
import { type FormEvent, Suspense, useCallback, useState } from 'react';
import { toast } from 'sonner';

import { Header } from '../header';
import { PluginCapabilityGrants } from './plugin-capability-grants';
import * as styles from './plugin-manager.css';

interface MutationApi {
  trigger: (args: unknown) => Promise<unknown>;
  isMutating: boolean;
}

function asMutation(api: unknown): MutationApi {
  return api as MutationApi;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleString();
}

function statusVariant(
  status: MnPluginDto['processStatus']
): 'default' | 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'RUNNING':
      return 'default';
    case 'CRASHED':
      return 'destructive';
    case 'LOADING':
      return 'secondary';
    default:
      return 'outline';
  }
}

const PluginRowSkeleton = () => (
  <div className={styles.skeletonRow}>
    <Skeleton className={styles.skeletonSquare} />
    <Skeleton className={styles.skeletonBar} />
  </div>
);

function PluginsList() {
  const queryArg = {
    query: mnPluginsQuery,
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, mutate, error } = useQuery(queryArg);

  const enableApi = asMutation(
    useMutation({ mutation: enableMnPluginMutation } as Parameters<
      typeof useMutation
    >[0])
  );
  const disableApi = asMutation(
    useMutation({ mutation: disableMnPluginMutation } as Parameters<
      typeof useMutation
    >[0])
  );
  const uninstallApi = asMutation(
    useMutation({ mutation: uninstallMnPluginMutation } as Parameters<
      typeof useMutation
    >[0])
  );

  const isMutating =
    enableApi.isMutating || disableApi.isMutating || uninstallApi.isMutating;

  const handleEnable = useCallback(
    async (id: string) => {
      try {
        await enableApi.trigger({ id });
        await mutate();
        toast.success('Plugin enabled');
      } catch (err) {
        toast.error(`Failed to enable plugin: ${(err as Error)?.message}`);
      }
    },
    [enableApi, mutate]
  );

  const handleDisable = useCallback(
    async (id: string) => {
      try {
        await disableApi.trigger({ id });
        await mutate();
        toast.success('Plugin disabled');
      } catch (err) {
        toast.error(`Failed to disable plugin: ${(err as Error)?.message}`);
      }
    },
    [disableApi, mutate]
  );

  const handleUninstall = useCallback(
    async (id: string, name: string) => {
      const ok = window.confirm(
        `Uninstall plugin "${name}"? Workspace configs will be deleted (cascade). This cannot be undone.`
      );
      if (!ok) return;
      try {
        await uninstallApi.trigger({ id });
        await mutate();
        toast.success(`Uninstalled ${name}`);
      } catch (err) {
        toast.error(`Failed to uninstall: ${(err as Error)?.message}`);
      }
    },
    [uninstallApi, mutate]
  );

  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        Failed to load plugins:{' '}
        {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  const plugins =
    (data as unknown as { mnPlugins?: MnPluginDto[] } | undefined)?.mnPlugins ??
    [];

  if (plugins.length === 0) {
    return (
      <div className={styles.emptyState}>
        No plugins installed yet. Install one from npm or a local package above.
      </div>
    );
  }

  return (
    <div className={styles.pluginList}>
      {plugins.map(plugin => (
        <Card key={plugin.id} className={styles.pluginCard}>
          <CardHeader className={styles.cardHeader}>
            <div className={styles.cardTitleRow}>
              <CardTitle className={styles.cardTitle}>{plugin.name}</CardTitle>
              <Badge variant={statusVariant(plugin.processStatus)}>
                {plugin.processStatus.toLowerCase()}
              </Badge>
            </div>
            <CardDescription>
              v{plugin.version} · installed {formatDate(plugin.installedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={styles.detailRow}>
              <Label>Package path</Label>
              <div className={styles.mono}>
                {plugin.packagePath ?? '<none>'}
              </div>
            </div>
            <div className={styles.detailRow}>
              <Label>Host API</Label>
              <div className={styles.mono}>
                {plugin.manifestJson?.hostApiVersion ?? '?'}
              </div>
            </div>
            <div className={styles.detailRow}>
              <Label>Capabilities</Label>
              <div className={styles.pillRow}>
                {(plugin.manifestJson?.capabilities ?? []).map(cap => (
                  <Badge key={cap} variant="secondary">
                    {cap}
                  </Badge>
                ))}
              </div>
            </div>
            <PluginCapabilityGrants plugin={plugin} onUpdated={mutate} />
          </CardContent>
          <CardFooter className={styles.cardFooter}>
            {plugin.processStatus === 'RUNNING' ||
            plugin.processStatus === 'LOADING' ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={isMutating}
                onClick={() => {
                  handleDisable(plugin.id).catch(console.error);
                }}
              >
                Disable
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={isMutating}
                onClick={() => {
                  handleEnable(plugin.id).catch(console.error);
                }}
              >
                Enable
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              disabled={isMutating}
              onClick={() => {
                handleUninstall(plugin.id, plugin.name).catch(console.error);
              }}
            >
              Uninstall
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function InstallPluginForm({ onInstalled }: { onInstalled: () => void }) {
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const installApi = asMutation(
    useMutation({ mutation: installMnPluginMutation } as Parameters<
      typeof useMutation
    >[0])
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = name.trim();
      const trimmedVersion = version.trim();
      if (!trimmedName || !trimmedVersion) {
        toast.error('Both package name and version are required');
        return;
      }
      try {
        await installApi.trigger({
          input: { name: trimmedName, version: trimmedVersion },
        });
        toast.success(`Installed ${trimmedName}@${trimmedVersion}`);
        setName('');
        setVersion('');
        onInstalled();
      } catch (err) {
        toast.error(`Install failed: ${(err as Error)?.message}`);
      }
    },
    [installApi, name, version, onInstalled]
  );

  return (
    <Card className={styles.installCard}>
      <CardHeader>
        <CardTitle>Install plugin</CardTitle>
        <CardDescription>
          Install an MnPlugin from the npm registry. The runtime validates the
          package manifest and registers the plugin in INSTALLED state. Enable
          it explicitly with the toggle below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={event => {
            handleSubmit(event).catch(console.error);
          }}
          className={styles.installForm}
        >
          <div className={styles.formField}>
            <Label htmlFor="plugin-name">Package name</Label>
            <Input
              id="plugin-name"
              placeholder="@my-org/manut-plugin-foo"
              value={name}
              onChange={event => setName(event.target.value)}
              disabled={installApi.isMutating}
              data-testid="install-plugin-name"
            />
          </div>
          <div className={styles.formField}>
            <Label htmlFor="plugin-version">Version</Label>
            <Input
              id="plugin-version"
              placeholder="0.1.0"
              value={version}
              onChange={event => setVersion(event.target.value)}
              disabled={installApi.isMutating}
              data-testid="install-plugin-version"
            />
          </div>
          <Button
            type="submit"
            disabled={installApi.isMutating || !name.trim() || !version.trim()}
            data-testid="install-plugin-submit"
          >
            {installApi.isMutating ? 'Installing…' : 'Install'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function PluginManagerPage() {
  // useQuery's mutate revalidates the install list; pass through so
  // InstallPluginForm can trigger a re-read after a successful install.
  const queryArg = {
    query: mnPluginsQuery,
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { mutate } = useQuery(queryArg);

  return (
    <div className="h-dvh flex-1 space-y-1 flex-col flex">
      <Header title="Plugins" />
      <ScrollArea>
        <div className={styles.page}>
          <InstallPluginForm
            onInstalled={() => {
              mutate?.().catch(console.error);
            }}
          />
          <Suspense
            fallback={
              <div className={styles.pluginList}>
                <PluginRowSkeleton />
                <PluginRowSkeleton />
              </div>
            }
          >
            <PluginsList />
          </Suspense>
        </div>
      </ScrollArea>
    </div>
  );
}

export { PluginManagerPage as Component };
