"use client";

import type { VariantProps } from "class-variance-authority";
import React from "react";

import { Button, type buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/providers/auth-provider";

interface PermissionButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  permission?: string;
  permissions?: string[];
  asChild?: boolean;
  tooltipMessage?: string;
}

export function PermissionButton({
  permission,
  permissions,
  tooltipMessage = "Permission denied",
  disabled,
  children,
  ...props
}: PermissionButtonProps) {
  const { hasPermission, hasAnyPermission } = useAuth();

  let permissionDenied = false;
  if (permission) {
    permissionDenied = !hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    permissionDenied = !hasAnyPermission(...permissions);
  }

  const isDisabled = disabled || permissionDenied;

  if (permissionDenied) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button {...props} disabled>
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{tooltipMessage}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button {...props} disabled={isDisabled}>
      {children}
    </Button>
  );
}
