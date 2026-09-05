import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

/**
 * Persistence layer for validator-monitor email alerts.
 *
 * Alert rules are stored in `validator_node_alerts`. Service code uses
 * these helpers — controller never talks to Prisma directly so we keep
 * the repo/service/controller separation set by other modules.
 */
export class ValidatorMonitorRepository {
  listAlerts() {
    return prisma.validatorNodeAlert.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  /** Only enabled rules are evaluated against fresh reports. */
  listEnabledAlerts() {
    return prisma.validatorNodeAlert.findMany({
      where: { enabled: true },
    });
  }

  getAlert(id: string) {
    return prisma.validatorNodeAlert.findUnique({ where: { id } });
  }

  createAlert(data: Prisma.ValidatorNodeAlertUncheckedCreateInput) {
    return prisma.validatorNodeAlert.create({ data });
  }

  updateAlert(id: string, data: Prisma.ValidatorNodeAlertUpdateInput) {
    return prisma.validatorNodeAlert.update({ where: { id }, data });
  }

  deleteAlert(id: string) {
    return prisma.validatorNodeAlert.delete({ where: { id } });
  }

  markTriggered(id: string, when: Date) {
    return prisma.validatorNodeAlert.update({
      where: { id },
      data: { lastTriggeredAt: when },
    });
  }
}

export const validatorMonitorRepository = new ValidatorMonitorRepository();
