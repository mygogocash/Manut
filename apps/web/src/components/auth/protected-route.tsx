"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { notFound, usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { signInPath } from "@/lib/auth-return-path";
import { useAuth } from "@/providers/auth-provider";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPermissions?: readonly string[];
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredPermissions,
  fallback,
}: ProtectedRouteProps) {
  const {
    user,
    isAuthenticated,
    isLoading,
    sessionVerificationError,
    hasPermission,
    hasAnyPermission,
    refreshUser,
  } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString();
  const returnPath = query ? `${pathname}?${query}` : pathname;

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !sessionVerificationError) {
      router.replace(signInPath(returnPath));
    }
  }, [
    isLoading,
    isAuthenticated,
    sessionVerificationError,
    router,
    returnPath,
  ]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [isLoading, isAuthenticated, user?.mustChangePassword, router]);

  if (isLoading) {
    return (
      fallback || (
        <div className="flex h-screen w-full items-center justify-center">
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

  if (!isAuthenticated && sessionVerificationError) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-6">
        <div
          role="alert"
          className={`
            border-border bg-surface flex w-full max-w-md flex-col items-center
            gap-4 rounded-xl border p-6 text-center shadow-sm
          `}
        >
          <AlertTriangle className="text-warning size-8" aria-hidden="true" />
          <div className="space-y-1">
            <h1 className="text-base font-semibold">
              Session check unavailable
            </h1>
            <p className="text-muted-foreground text-sm">
              {sessionVerificationError.message}
            </p>
          </div>
          <Button type="button" onClick={() => void refreshUser()}>
            <RefreshCw aria-hidden="true" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (user?.mustChangePassword) {
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
