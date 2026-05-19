import { Module } from '@nestjs/common';

import { StorageModule } from '../storage';
import { AiBudgetService } from './ai-budget.service';
import { QuotaService } from './service';

@Module({
  imports: [StorageModule],
  providers: [QuotaService, AiBudgetService],
  exports: [QuotaService, AiBudgetService],
})
export class QuotaServiceModule {}
