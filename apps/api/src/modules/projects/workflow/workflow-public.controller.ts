import type { Response } from "express";
import { Router } from "express";

import {
  ALL_PERMISSION_CODES,
  normalizePermissionCode,
} from "@/common/constants/permissions";
import { logger } from "@/common/utils/logger";
import { asyncHandler } from "@/core/middleware/async-handler";
import { prisma } from "@/infrastructure/database/prisma";
import { workflowService } from "@/modules/projects/workflow/workflow.service";
import { WORKFLOW_STATUS } from "@/modules/projects/workflow/workflow.types";
import { verifyActionToken } from "@/modules/projects/workflow/workflow-token";

// One-click approval from an approval email.
//
// This router is intentionally mounted OUTSIDE the `authenticate` guard: the
// signed token is the credential. Every other control still applies —
// permissions are re-resolved live, the token is bound to one project + stage
// + actor, and the transition itself runs through the same workflow service
// (same legality, atomicity and audit logging) as the in-app path.

const router = Router();

const PORTAL_URL = (
  process.env.PORTAL_URL ?? "https://intranet.thebinaryholdings.com"
).replace(/\/+$/, "");

/** Mirrors auth.service.resolvePermissions (incl. system-Admin bypass). */
function resolvePermissions(
  userRoles: {
    role: {
      isSystem: boolean;
      name: string;
      rolePermissions: { permissionCode: string }[];
    };
  }[],
): string[] {
  const isSuperAdmin = userRoles.some(
    (ur) => ur.role.isSystem && ur.role.name === "Admin",
  );
  if (isSuperAdmin) return ALL_PERMISSION_CODES.map(normalizePermissionCode);
  const out = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      out.add(normalizePermissionCode(rp.permissionCode));
    }
  }
  return [...out];
}

function redirect(res: Response, projectId: string | null, status: string) {
  const target = projectId
    ? `${PORTAL_URL}/projects/requests/${projectId}?emailAction=${status}`
    : `${PORTAL_URL}/projects/requests?emailAction=${status}`;
  return res.redirect(302, target);
}

router.get(
  "/email-action",
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return redirect(res, null, "invalid");

    const verified = verifyActionToken(token);
    if (verified.ok !== true) {
      const { reason } = verified;
      logger.warn("Workflow email action rejected", { reason });
      return redirect(res, null, reason);
    }

    const { p: projectId, u: userId, a: action, s: stage } = verified.payload;

    // The token is only valid while the project is still at the stage it was
    // issued for. Once it moves on, the link is spent — this is what makes it
    // single-use without a token table.
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workflowStatus: true },
    });
    if (!project) return redirect(res, null, "notfound");
    const current = project.workflowStatus ?? WORKFLOW_STATUS.DRAFT;
    if (current !== stage) return redirect(res, projectId, "superseded");

    // Re-resolve permissions live, so revoking a role also kills pending links.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        userRoles: {
          select: {
            role: {
              select: {
                isSystem: true,
                name: true,
                rolePermissions: { select: { permissionCode: true } },
              },
            },
          },
        },
      },
    });
    if (!user || !user.isActive) return redirect(res, projectId, "forbidden");
    const perms = resolvePermissions(user.userRoles);

    try {
      if (action === "complete") {
        await workflowService.complete(
          projectId,
          userId,
          perms,
          undefined,
          req,
        );
      } else {
        await workflowService.approve(projectId, userId, perms, undefined, req);
      }
      return redirect(res, projectId, "approved");
    } catch (err) {
      logger.warn("Workflow email action could not be applied", {
        projectId,
        error: err instanceof Error ? err.message : String(err),
      });
      return redirect(res, projectId, "failed");
    }
  }),
);

export default router;
