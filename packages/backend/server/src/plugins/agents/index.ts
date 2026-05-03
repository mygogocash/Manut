import { Module } from '@nestjs/common';

import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { AgentsResolver } from './resolver';
import { AgentsService } from './service';

@Module({
  imports: [AuthModule, PermissionModule],
  providers: [AgentsService, AgentsResolver],
  exports: [AgentsService],
})
export class AgentsModule {}
