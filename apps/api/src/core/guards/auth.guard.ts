import type { NextFunction, Request, Response } from "express";

import {
  ALL_PERMISSION_CODES,
  normalizePermissionCode,
} from "@/common/constants/permissions";
import {
  ForbiddenException,
  UnauthorizedException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { supabaseAdmin } from "@/infrastructure/supabase/admin";
import { trackPermissionDenied } from "@/lib/events";
import {
  applyManagerImplicitPerms,
  countActiveDirectReports,
} from "@/modules/auth/manager-implicit-perms";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  entityId: string | null;
  permissions: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Required for Express Request augmentation
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.substring("Bearer ".length);
}

export async function resolveAuthUserFromToken(
  token: string | undefined,
): Promise<AuthUser> {
  if (!token) {
    throw new UnauthorizedException();
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new UnauthorizedException();
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      entityId: true,
    },
  });

  if (!profile) {
    throw new UnauthorizedException("User not found");
  }

  return { ...profile, permissions: [] };
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    let token = getBearerToken(req.headers.authorization) ?? undefined;

    if (!token && req.cookies?.nexora_access_token) {
      token = req.cookies.nexora_access_token;
    }

    req.user = await resolveAuthUserFromToken(token);
    next();
  } catch (err) {
    if (err instanceof UnauthorizedException) {
      return next(err);
    }
    next(new UnauthorizedException());
  }
}

export async function requireActive(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return next(new UnauthorizedException());
  }
  if (!req.user.isActive) {
    return next(new ForbiddenException("Account deactivated"));
  }
  next();
}

/**
 * Lazy-load permissions onto `req.user` if a route reads them outside
 * of a `requirePermission(...)` gate.
 *
 * `authenticate` ships the request with `permissions: []` and the
 * `requirePermission` middleware fills it on first use — which is fine
 * for routes that gate themselves, but a hard footgun for routes that
 * "authorise inside the service" (e.g. `GET /hrms/agreements`, where
 * the same endpoint serves employees viewing their own files and HR
 * viewing anyone's). Without this call, the service sees an empty
 * permissions array, decides the caller is "just an employee", and
 * scopes the query to `actorId` — silently returning zero documents
 * for HR/admin even though the data exists.
 */
export async function ensurePermissionsLoaded(req: Request): Promise<void> {
  if (!req.user) return;
  if (req.user.permissions.length > 0) return;
  const perms = await loadUserPermissions(req.user.id);
  req.user.permissions = Array.from(perms);
}

/** Resolves effective permission codes (roles + module access), normalized. */
export async function loadUserPermissions(
  userId: string,
): Promise<Set<string>> {
  const permissions = new Set<string>();

  const userWithRoles = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: true },
          },
        },
      },
      moduleAccessGrants: true,
    },
  });

  if (!userWithRoles) return permissions;

  // System "Admin" role implicitly grants every registered permission.
  // Without this, newly-added permission codes (e.g. crm:* in Phase 1 of
  // Sales CRM v2) silently lock super-admins out of new modules until
  // someone re-runs `pnpm db:seed-prod`. Module-access grants below can
  // still revoke individual modules for the admin if explicitly toggled
  // off.
  const isSuperAdmin = userWithRoles.userRoles.some(
    (ur) => ur.role.isSystem && ur.role.name === "Admin",
  );
  if (isSuperAdmin) {
    for (const code of ALL_PERMISSION_CODES) {
      permissions.add(normalizePermissionCode(code));
    }
  } else {
    for (const userRole of userWithRoles.userRoles) {
      for (const rolePerm of userRole.role.rolePermissions) {
        permissions.add(normalizePermissionCode(rolePerm.permissionCode));
      }
    }
  }

  for (const access of userWithRoles.moduleAccessGrants) {
    if (!access.granted) {
      for (const perm of permissions) {
        if (perm.startsWith(`${access.moduleId}:`)) {
          permissions.delete(perm);
        }
      }
    }
  }

  // Implicit manager grants — line managers (anyone with at least one
  // active direct report) receive the approval-flow perms even if no
  // role assignment grants them. The service-layer gates still enforce
  // the manager-of-the-submitter check, so this only widens the coarse
  // route-level pre-filter so the "Approve" button surfaces in the UI.
  // Skipped for super-admins (already have everything).
  if (!isSuperAdmin) {
    const directReportCount = await countActiveDirectReports(userId);
    applyManagerImplicitPerms(permissions, directReportCount > 0);
  }

  return permissions;
}

export function requirePermission(...requiredPermissions: string[]) {
  // Named rather than anonymous so it is identifiable in an Express middleware
  // stack, which lets a test assert a route is gated, and so it reads as itself
  // in a stack trace.
  return async function requirePermissionGuard(
    req: Request,
    _res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) return next(new UnauthorizedException());
      if (!req.user.isActive) {
        return next(new ForbiddenException("Account deactivated"));
      }

      if (req.user.permissions.length === 0) {
        const perms = await loadUserPermissions(req.user.id);
        req.user.permissions = Array.from(perms);
      }

      const userPerms = new Set(req.user.permissions);
      const hasPermission = requiredPermissions.some((p) => userPerms.has(p));

      if (!hasPermission) {
        trackPermissionDenied(
          { id: req.user.id, entityId: req.user.entityId },
          {
            permission: requiredPermissions[0] ?? "unknown",
            route: req.path,
          },
        );
        return next(new ForbiddenException("Permission denied"));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Is this user in the system "Admin" role?
 *
 * Deliberately NOT a permission check. A super admin is granted every
 * permission code (see `loadUserPermissions`), so no code can ever be exclusive
 * to them: any code, `admin:manage` included, can also be granted to a custom
 * role. Identity is the only thing that distinguishes them, which is why this
 * reads the role assignment rather than `req.user.permissions`.
 */
export async function isSystemAdmin(userId: string): Promise<boolean> {
  const match = await prisma.userRole.findFirst({
    where: {
      userId,
      role: { isSystem: true, name: "Admin", deletedAt: null },
    },
    select: { userId: true },
  });
  return match !== null;
}

/**
 * Restricts a route to the system "Admin" role.
 *
 * For settings that decide how a whole flow behaves rather than one record —
 * configuring an approval chain, for instance, where a bad edit changes who may
 * approve everything. `requirePermission` cannot express this, per the note on
 * `isSystemAdmin` above.
 *
 * Costs one indexed lookup, on the handful of routes that need it.
 */
export function requireSystemAdmin() {
  return async function requireSystemAdminGuard(
    req: Request,
    _res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) return next(new UnauthorizedException());
      if (!req.user.isActive) {
        return next(new ForbiddenException("Account deactivated"));
      }

      if (!(await isSystemAdmin(req.user.id))) {
        trackPermissionDenied(
          { id: req.user.id, entityId: req.user.entityId },
          { permission: "system-admin", route: req.path },
        );
        return next(
          new ForbiddenException(
            "Only a system administrator can change this setting",
          ),
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
