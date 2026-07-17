"use client";

import { AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface NotConnectedBannerProps {
  /** User-facing feature name shown in copy, e.g. "Gmail" or "Drive". */
  feature: string;
}

/**
 * Inline banner shown on Gmail / Drive pages when the API returns
 * 412 GOOGLE_NOT_CONNECTED. Directs the user to /settings?tab=integrations.
 */
export function NotConnectedBanner({ feature }: NotConnectedBannerProps) {
  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent
        className={`
          flex flex-col gap-3 py-4
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="text-warning mt-0.5 size-5 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="text-foreground text-sm font-medium">
              Google Workspace not connected
            </p>
            <p className="text-foreground-secondary text-xs">
              Connect your Google account in Settings to use {feature}.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/settings?tab=integrations">
            Go to Settings
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
