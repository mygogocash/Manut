"use client";

import { AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shown when Google is connected for read-only Gmail. Sending requires
 * reconnecting so Google grants compose/send scopes.
 */
export function GmailSendScopeBanner() {
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
              Gmail send access needed
            </p>
            <p className="text-foreground-secondary text-xs">
              Your Google account is connected for reading only. Disconnect and
              reconnect in Settings to enable sending from the portal.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/settings?tab=integrations">
            Reconnect Google
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
