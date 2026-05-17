import { DynamicModule, Module } from '@nestjs/common';

import { PermissionModule } from '../../core/permission';
import { isManutModuleEnabled } from './manut.module';
import { MnApprovalResolver } from './manut-approval.resolver';
import { MnApprovalService } from './manut-approval.service';
import { MnApprovalCommentService } from './manut-approval-comment.service';
import { MnApprovalGateService } from './manut-approval-gate.service';
import { MnApprovalStaleCron } from './manut-approval-stale.cron';
import {
  MnApprovalEventBus,
  MnApprovalsStreamController,
} from './manut-approvals-stream.controller';

/**
 * M3 — Manut approvals + reviews.
 *
 * Folded into the broader `ManutModule` via `manut.module.ts` — this
 * file exists as a standalone DynamicModule for the same two reasons
 * `ManutAgentModule` does:
 *
 *  1. The approvals surface has its own gating story today
 *     (`ENABLE_MANUT_MODULE` covers it). Keeping the providers list
 *     local avoids piling more into ManutModule's already long
 *     `forRoot`.
 *
 *  2. The DI metadata guard spec (`di-metadata-guard.spec.ts`) walks
 *     EVERY `.module.ts` for providers and verifies each has
 *     `@Injectable()` / `@Resolver()`. Splitting approvals into its
 *     own module lets the guard pinpoint the offending class.
 *
 * Gated by `isManutModuleEnabled()`. When disabled, the dynamic
 * module loads with an empty providers array so the import graph
 * still resolves but nothing wires up.
 */
@Module({})
export class ManutApprovalModule {
  static forRoot(): DynamicModule {
    if (!isManutModuleEnabled()) {
      return {
        module: ManutApprovalModule,
        imports: [PermissionModule],
        providers: [],
        exports: [],
      };
    }

    return {
      module: ManutApprovalModule,
      imports: [PermissionModule],
      controllers: [MnApprovalsStreamController],
      providers: [
        MnApprovalGateService,
        MnApprovalService,
        MnApprovalCommentService,
        MnApprovalResolver,
        MnApprovalStaleCron,
        MnApprovalEventBus,
      ],
      // Export the gate + service so the copilot provider can inject
      // them without re-registering. The gate is the hot-path consumer
      // (called from every tool dispatch); the service is the one the
      // gate refreshes against.
      exports: [MnApprovalGateService, MnApprovalService, MnApprovalEventBus],
    };
  }
}
