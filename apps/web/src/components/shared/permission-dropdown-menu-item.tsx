"use client";

import React from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/providers/auth-provider";

interface PermissionDropdownMenuItemProps extends React.ComponentProps<
  typeof DropdownMenuItem
> {
  permission?: string;
  permissions?: string[];
  tooltipMessage?: string;
}

export function PermissionDropdownMenuItem({
  permission,
  permissions,
  tooltipMessage = "Permission denied",
  children,
  className,
  ...props
}: PermissionDropdownMenuItemProps) {
  const { hasPermission, hasAnyPermission } = useAuth();

  let permissionDenied = false;
  if (permission) {
    permissionDenied = !hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    permissionDenied = !hasAnyPermission(...permissions);
  }

  if (permissionDenied) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <DropdownMenuItem
                {...props}
                disabled
                className={className}
                onSelect={(e) => e.preventDefault()}
              >
                {children}
              </DropdownMenuItem>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">{tooltipMessage}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenuItem {...props} className={className}>
      {children}
    </DropdownMenuItem>
  );
}
