import { DynamicModule, Module } from '@nestjs/common';

import { PermissionModule } from '../../core/permission';
import { isManutModuleEnabled } from './manut.module';
import { MnGoalResolver } from './manut-goal.resolver';
import { MnGoalService } from './manut-goal.service';
import { MnGoalContextService } from './manut-goal-context.service';

/**
 * M2 goal hierarchy + task ancestry + blockers (PM rev 2).
 *
 * Folded into the broader `ManutModule` via `manut.module.ts` —
 * this file exists as a standalone DynamicModule for the same two
 * reasons as `manut-agent.module.ts`:
 *
 *  1. The goal hierarchy is gated by the same env flag as the wider
 *    Manut suite today, but may grow its own toggle later. Keeping
 *    the providers list local avoids piling more into ManutModule's
 *    already long `forRoot()`.
 *
 *  2. The DI metadata guard spec walks every `.module.ts` in this
 *    folder. Splitting into its own module lets the guard point at
 *    the offending class cleanly.
 *
 * Gated by `isManutModuleEnabled()`. When disabled, the dynamic module
 * loads with an empty providers array.
 */
@Module({})
export class ManutGoalModule {
  static forRoot(): DynamicModule {
    if (!isManutModuleEnabled()) {
      return {
        module: ManutGoalModule,
        imports: [PermissionModule],
        providers: [],
        exports: [],
      };
    }
    return {
      module: ManutGoalModule,
      imports: [PermissionModule],
      providers: [MnGoalService, MnGoalContextService, MnGoalResolver],
      // Export the services so callers (e.g. auto-router via the
      // context service, future heartbeat consumer, MCP bridge) can
      // inject them without re-registering.
      exports: [MnGoalService, MnGoalContextService],
    };
  }
}
