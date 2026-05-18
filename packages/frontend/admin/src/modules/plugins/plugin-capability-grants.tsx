import { Badge } from '@affine/admin/components/ui/badge';
import { Button } from '@affine/admin/components/ui/button';
import { Label } from '@affine/admin/components/ui/label';
import { useMutation } from '@affine/admin/use-mutation';
import {
  type MnPluginConfigDto,
  type MnPluginDto,
  upsertMnPluginConfigMutation,
} from '@affine/core/modules/manut-control-plane';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import * as styles from './plugin-manager.css';

interface MutationApi {
  trigger: (args: unknown) => Promise<unknown>;
  isMutating: boolean;
}

interface PluginCapabilityGrantsProps {
  plugin: MnPluginDto;
  onUpdated: () => Promise<unknown> | void;
}

/**
 * Capability-grant editor for the per-plugin admin panel.
 *
 * The plugin manifest declares a set of capabilities the worker may
 * request (e.g. `read.workspace`, `write.doc`). An instance admin may
 * revoke any of them; the revocation is persisted as
 * `configJson.capabilityOverrides.revoked: string[]` on the
 * instance-wide config row (workspaceId === "_instance", projectId IS
 * NULL). The host RPC bridge consults the override list before allowing
 * any capability-gated call.
 *
 * NOTE: This UI uses local optimistic state — the server is the source
 * of truth. Revoke + grant fires upsert mutations with workspaceId
 * `_instance` so the override applies instance-wide; per-workspace
 * overrides are configured in the workspace settings panel
 * (workspace-plugins.tsx).
 */
const INSTANCE_WORKSPACE_ID = '_instance';

export function PluginCapabilityGrants({
  plugin,
  onUpdated,
}: PluginCapabilityGrantsProps) {
  const upsertApi = useMutation({
    mutation: upsertMnPluginConfigMutation,
  } as Parameters<typeof useMutation>[0]) as unknown as MutationApi;

  const allCapabilities = useMemo(
    () => plugin.manifestJson?.capabilities ?? [],
    [plugin.manifestJson?.capabilities]
  );

  // Source of truth lives in configJson.capabilityOverrides.revoked.
  // The admin app does not load instance-level configs in this iteration
  // (no admin-level GraphQL query); start empty + accumulate locally
  // until the next page reload reads from the backend.
  const [revoked, setRevoked] = useState<string[]>([]);

  const handleToggle = useCallback(
    async (capability: string) => {
      const wasRevoked = revoked.includes(capability);
      const nextRevoked = wasRevoked
        ? revoked.filter(c => c !== capability)
        : [...revoked, capability];

      const nextConfig: MnPluginConfigDto['configJson'] = {
        capabilityOverrides: { revoked: nextRevoked },
      };

      try {
        await upsertApi.trigger({
          input: {
            workspaceId: INSTANCE_WORKSPACE_ID,
            pluginId: plugin.id,
            configJson: nextConfig,
          },
        });
        setRevoked(nextRevoked);
        toast.success(
          wasRevoked ? `Granted ${capability}` : `Revoked ${capability}`
        );
        await onUpdated();
      } catch (err) {
        toast.error(`Capability change failed: ${(err as Error)?.message}`);
      }
    },
    [revoked, plugin.id, upsertApi, onUpdated]
  );

  if (allCapabilities.length === 0) {
    return null;
  }

  return (
    <div className={styles.detailRow} data-testid="cp-capability-grants">
      <Label>Capability grants (instance-wide)</Label>
      <div className={styles.capabilityGrantList}>
        {allCapabilities.map(capability => {
          const isRevoked = revoked.includes(capability);
          return (
            <div
              key={capability}
              className={styles.capabilityGrantRow}
              data-capability={capability}
              data-revoked={isRevoked ? 'true' : 'false'}
            >
              <Badge variant={isRevoked ? 'outline' : 'default'}>
                {capability}
              </Badge>
              <Button
                size="sm"
                variant={isRevoked ? 'secondary' : 'destructive'}
                disabled={upsertApi.isMutating}
                onClick={() => {
                  handleToggle(capability).catch(console.error);
                }}
              >
                {isRevoked ? 'Grant' : 'Revoke'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
