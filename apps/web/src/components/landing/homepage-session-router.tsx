"use client";

import { useRouter } from "nextjs-toploader/app";
import { useEffect, useRef } from "react";

import { useAuth } from "@/providers/auth-provider";

/**
 * Resolves session routing for visitors to the root page (`/`).
 *
 * - Signed-out visitors remain on `/` (even after 401 session refresh failure).
 * - Authenticated visitors are replaced into their workspace:
 *   1. Mandatory password change -> /change-password
 *   2. Employee-only accounts   -> /my-portal
 *   3. All other staff          -> /dashboard
 */
export function HomepageSessionRouter() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, isEmployeeOnly } = useAuth();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user || redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;
    if (user.mustChangePassword) {
      router.replace("/change-password");
    } else if (isEmployeeOnly) {
      router.replace("/my-portal");
    } else {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, user, isEmployeeOnly, router]);

  return null;
}
