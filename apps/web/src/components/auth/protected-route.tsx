"use client";

import { notFound, usePathname } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { useEffect } from "react";

import { useAuth } from "@/providers/auth-provider";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[];
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredPermissions,
  fallback,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, hasPermission, hasAnyPermission } =
    useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Keep the query string. A deep link from an email is often
      // `/projects?view=pending` or `/leave?id=…`; parking only the pathname
      // returned the user to the right page with the wrong state, which reads
      // as the link having been wrong.
      //
      // Read from `window` rather than `useSearchParams()` on purpose: most
      // dashboard routes prerender as static shells, and the hook would force
      // them dynamic. `auth-provider`'s `safeRedirectTarget` reads the same way
      // and validates the value before using it.
      const search =
        typeof window === "undefined" ? "" : window.location.search;
      const target = `${pathname}${search}`;
      router.push(`/sign-in?redirect=${encodeURIComponent(target)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.mustChangePassword) {
      router.push("/change-password");
    }
  }, [isLoading, isAuthenticated, user?.mustChangePassword, router]);

  if (isLoading) {
    return (
      fallback || (
        <div className="flex h-svh w-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className={`
                border-primary h-10 w-10 animate-spin rounded-full border-2
                border-t-transparent
              `}
            />
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    notFound();
  }

  if (
    requiredPermissions &&
    requiredPermissions.length > 0 &&
    !hasAnyPermission(...requiredPermissions)
  ) {
    notFound();
  }

  return <>{children}</>;
}
