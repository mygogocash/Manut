import { Module } from '@nestjs/common';

import { QuotaResolver } from './resolver';
import { QuotaService } from './service';
import { QuotaServiceModule } from './service.module';

/**
 * Quota module provider pre-user quota management.
 * includes:
 * - quota query/update/permit
 * - quota statistics
 * - AI budget gating (Wave 6 / E1.12)
 */
@Module({
  imports: [QuotaServiceModule],
  providers: [QuotaResolver],
  exports: [QuotaServiceModule],
})
export class QuotaModule {}

export { QuotaService };
export { QuotaServiceModule };
export {
  type AiBudgetCapDetail,
  aiBudgetCapMessage,
  AiBudgetExceeded,
  AiBudgetService,
  currentPeriodStart,
} from './ai-budget.service';
export { WorkspaceQuotaHumanReadableType, WorkspaceQuotaType } from './types';
