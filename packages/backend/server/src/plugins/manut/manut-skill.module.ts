import { Module } from '@nestjs/common';

import { PermissionModule } from '../../core/permission';
import { MnExportSnapshotService } from './manut-export-snapshot.service';
import { MnSkillResolver } from './manut-skill.resolver';
import { MnSkillService } from './manut-skill.service';

/**
 * M5 — Skills layer + portability snapshot.
 *
 * Standalone module so the broader Manut umbrella can opt in to the
 * skill / export surface without dragging the rest of the suite. The
 * combined `ManutModule` registers these providers directly inside its
 * own enabled branch (gated by `isManutModuleEnabled()`); this module
 * is here for future M5.2 wiring (Branch B owns the AGENTS.md parser
 * that will live alongside these services).
 */
@Module({
  imports: [PermissionModule],
  providers: [MnSkillService, MnSkillResolver, MnExportSnapshotService],
  exports: [MnSkillService, MnExportSnapshotService],
})
export class ManutSkillModule {}
