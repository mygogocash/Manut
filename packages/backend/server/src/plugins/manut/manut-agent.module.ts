import { DynamicModule, Module } from '@nestjs/common';

import { PermissionModule } from '../../core/permission';
import { isManutModuleEnabled } from './manut.module';
import { MnAgentResolver } from './manut-agent.resolver';
import { MnAgentService } from './manut-agent.service';
import { MnAgentApiKeyResolver } from './manut-agent-api-key.resolver';
import { MnAgentApiKeyService } from './manut-agent-api-key.service';
import { MnHeartbeatService } from './manut-heartbeat.service';

/**
 * M1 Manut agent identity (CRUD + API keys + heartbeats).
 *
 * Folded into the broader `ManutModule` via `manut.module.ts` —
 * this file exists as a standalone DynamicModule for two reasons:
 *
 *  1. The agent identity surface has its own gating story (it lives
 *     under the same `ENABLE_MANUT_MODULE` flag today, but may grow
 *     a dedicated `ENABLE_MANUT_AGENTS` later in M2). Keeping the
 *     providers list local avoids piling more into ManutModule's
 *     already long `forRoot`.
 *
 *  2. The DI metadata guard spec (di-metadata-guard.spec.ts) walks
 *     EVERY `.module.ts` for providers and verifies each has
 *     `@Injectable()` / `@Resolver()`. Splitting agent identity into
 *     its own module keeps the catchphrase short and lets the guard
 *     pinpoint the offending class.
 *
 * Gated by `isManutModuleEnabled()`. When disabled, the dynamic
 * module loads with an empty providers array so the import graph
 * still resolves but nothing wires up.
 */
@Module({})
export class ManutAgentModule {
  static forRoot(): DynamicModule {
    if (!isManutModuleEnabled()) {
      return {
        module: ManutAgentModule,
        imports: [PermissionModule],
        providers: [],
        exports: [],
      };
    }

    return {
      module: ManutAgentModule,
      imports: [PermissionModule],
      providers: [
        MnAgentService,
        MnAgentResolver,
        MnAgentApiKeyService,
        MnAgentApiKeyResolver,
        MnHeartbeatService,
      ],
      // Export the services so future modules (chat session bridge,
      // routine runner, MCP authn middleware) can inject them without
      // re-registering.
      exports: [MnAgentService, MnAgentApiKeyService, MnHeartbeatService],
    };
  }
}
