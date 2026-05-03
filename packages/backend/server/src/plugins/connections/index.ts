import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { ConnectionsController } from './connections.controller';
import { ConnectionsResolver } from './connections.resolver';
import { ConnectionsService } from './connections.service';

@Module({
  imports: [AuthModule, ServerConfigModule],
  providers: [ConnectionsService, ConnectionsResolver],
  controllers: [ConnectionsController],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
