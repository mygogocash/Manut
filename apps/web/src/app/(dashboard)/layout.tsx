"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { Suspense, useEffect, useRef } from "react";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppSidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { GlobalMessageNotifier } from "@/components/messages/global-message-notifier";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { type ModuleId, trackModuleViewed } from "@/lib/events";
import { resolveRoutePermissionPolicy } from "@/lib/route-permissions";
import { useAuth } from "@/providers/auth-provider";

const MODULE_FROM_FIRST_SEGMENT: Record<string, ModuleId> = {
  dashboard: "home",
  messages: "messaging",
  projects: "projects",
  partners: "partner_crm",
  sales: "sales_crm",
  deals: "sales_crm",
  "investor-crm": "partner_crm",
  investors: "partner_crm",
  "investor-updates": "partner_crm",
  employees: "employees",
  directory: "employees",
  leave: "leave",
  travel: "travel",
  careers: "careers",
  applications: "careers",
  survey: "survey",
  payroll: "payroll",
  legal: "legal",
  dataroom: "legal",
  hrms: "hrms",
  learning: "learning",
  visa: "visa",
  benefits: "benefits",
  "my-portal": "my_portal",
  admin: "admin",
  settings: "settings",
};

function DashboardRouteFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div
        aria-label="Loading application"
        className={`
          border-primary size-10 animate-spin rounded-full border-2
          border-t-transparent
        `}
      />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isEmployeeOnly, isLoading, isAuthenticated } = useAuth();
  const routePolicy = resolveRoutePermissionPolicy(pathname);
  const isEmployeeAllowed = routePolicy?.employeeAllowed ?? false;
  const requiredPermissions = routePolicy?.permissions;
  const shouldRedirectEmployee =
    !isLoading && isEmployeeOnly && !isEmployeeAllowed;

  useEffect(() => {
    if (!shouldRedirectEmployee) return;

    router.replace("/my-portal");
  }, [shouldRedirectEmployee, router]);

  // module.viewed — fires once per module change. Single useEffect for all 18+
  // modules; per-page instrumentation is intentionally NOT used.
  const lastModuleRef = useRef<ModuleId | null>(null);
  useEffect(() => {
    if (!isAuthenticated) return;
    const segments = pathname.split("/").filter(Boolean);
    const firstSegment = segments[0] ?? "";
    const moduleId = MODULE_FROM_FIRST_SEGMENT[firstSegment];
    if (!moduleId) return;
    if (moduleId === lastModuleRef.current) return;
    lastModuleRef.current = moduleId;
    trackModuleViewed({
      module: moduleId,
      sub_section: segments[1],
    });
  }, [pathname, isAuthenticated]);

  return (
    <Suspense fallback={<DashboardRouteFallback />}>
      <ProtectedRoute requiredPermissions={requiredPermissions}>
        {!shouldRedirectEmployee && (
          <>
            <GlobalMessageNotifier />
            <SidebarProvider defaultOpen={true} className="h-svh min-h-0!">
              <AppSidebar />
              <SidebarInset className="min-h-0 overflow-hidden">
                <Topbar />
                <main
                  className={`
                    bg-background flex min-h-0 flex-1 flex-col overflow-hidden
                  `}
                >
                  <div
                    data-ph-scroll-root
                    className={`
                      scrollbar-thin scrollbar-track-transparent
                      scrollbar-thumb-border flex min-h-0 w-full flex-1 flex-col
                      overflow-auto px-6 py-5
                      hover:scrollbar-thumb-muted-foreground/30
                    `}
                  >
                    {children}
                  </div>
                </main>
              </SidebarInset>
            </SidebarProvider>
          </>
        )}
      </ProtectedRoute>
    </Suspense>
  );
}
