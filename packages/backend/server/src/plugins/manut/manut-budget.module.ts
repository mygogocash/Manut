import { Module } from '@nestjs/common';

import { PermissionModule } from '../../core/permission';
import { MnBudgetResolver } from './manut-budget.resolver';
import { MnBudgetService } from './manut-budget.service';
import { MnBudgetEnforcerService } from './manut-budget-enforcer.service';
import { MnCostService } from './manut-cost.service';

/**
 * Standalone Manut budget module (M4). Wrapped here so the providers can
 * be re-used outside the umbrella `ManutModule` should a future env-flag
 * carve them out (mirrors `manut-agent.module.ts`).
 *
 * In the deployed stack, `ManutModule.forRoot()` registers these same
 * providers under `isManutModuleEnabled()`.
 */
@Module({
  imports: [PermissionModule],
  providers: [
    MnCostService,
    MnBudgetService,
    MnBudgetEnforcerService,
    MnBudgetResolver,
  ],
  exports: [MnCostService, MnBudgetService, MnBudgetEnforcerService],
})
export class ManutBudgetModule {}
