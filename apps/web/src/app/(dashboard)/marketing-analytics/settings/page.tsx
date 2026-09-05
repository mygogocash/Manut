"use client";

import { ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";

export default function MarketingAnalyticsSettingsPage() {
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission(
    "marketing:dashboard:view",
    "marketing:raw:view",
  );

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Marketing Analytics Settings" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to Marketing Analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Marketing Analytics Settings"
        subtitle="Configuration for the Marketing Analytics module"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/marketing-analytics">
            <ArrowLeft className="mr-1 size-3.5" />
            Marketing Analytics
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardContent
          className={`
            text-muted-foreground flex flex-col items-center justify-center
            gap-3 py-16 text-center
          `}
        >
          <Settings className="size-7 opacity-40" />
          <p className="text-sm">
            Settings for metric selection, sync cadence, and saved views arrive
            in a later phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
