import { Module } from '@nestjs/common';

import { ManutPluginResolver } from './manut-plugin.resolver';
import { ManutPluginConfigService } from './manut-plugin-config.service';
import { ManutPluginHostRpcService } from './manut-plugin-host-rpc.service';
import { ManutPluginInstallerService } from './manut-plugin-installer.service';
import { ManutPluginRoutesController } from './manut-plugin-routes.controller';
import { ManutPluginRuntimeService } from './manut-plugin-runtime.service';
import { ManutPluginSupervisorService } from './manut-plugin-supervisor.service';

/**
 * M6a — Plugin runtime + IPC + capability gates.
 *
 * Standalone module so the broader Manut umbrella can opt in to the
 * plugin surface without dragging the rest of the suite. The combined
 * `ManutModule` registers these providers directly inside its own
 * enabled branch (gated by `isManutModuleEnabled()`).
 *
 * Trust boundary: the runtime spawns each plugin in a `child_process.fork`
 * worker with a JSON-RPC bridge over IPC. The host RPC surface
 * capability-gates every call against the plugin's manifest. See
 * `packages/backend/plugin-sdk/README.md` for the full threat model
 * and what M6a does NOT cover (UI sandboxing, raw sockets).
 */
@Module({
  controllers: [ManutPluginRoutesController],
  providers: [
    ManutPluginSupervisorService,
    ManutPluginHostRpcService,
    ManutPluginInstallerService,
    ManutPluginRuntimeService,
    ManutPluginConfigService,
    ManutPluginResolver,
  ],
  exports: [
    ManutPluginRuntimeService,
    ManutPluginInstallerService,
    ManutPluginHostRpcService,
    ManutPluginSupervisorService,
    ManutPluginConfigService,
  ],
})
export class ManutPluginModule {}
