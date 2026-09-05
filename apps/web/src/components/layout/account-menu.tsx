"use client";

import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// The account menu, defined once.
//
// These are the actions the sidebar footer has always offered. They are lifted
// out here so the topbar can offer the same set without a second copy: two
// hand-maintained lists would drift, and "Sign out is missing from one of the
// menus" is exactly the kind of divergence nobody notices until someone cannot
// log out on their phone.
//
// No new account functionality — same three destinations, same handler.

/** Navigation entries, in menu order. Routes that already exist. */
export const ACCOUNT_MENU_LINKS = [
  { href: "/my-portal", label: "My Portal", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export interface AccountMenuItemsProps {
  /** The `logout` from `useAuth()`. Passed in so this stays presentational. */
  onLogout: () => void;
  /** Called before navigating — used by the drawer to close itself. */
  onNavigate?: () => void;
}

export function AccountMenuItems({
  onLogout,
  onNavigate,
}: AccountMenuItemsProps) {
  return (
    <>
      {ACCOUNT_MENU_LINKS.map(({ href, label, icon: Icon }) => (
        <DropdownMenuItem key={href} asChild>
          <Link href={href} onClick={onNavigate}>
            <Icon />
            <span>{label}</span>
          </Link>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onLogout}>
        <LogOut />
        <span>Sign out</span>
      </DropdownMenuItem>
    </>
  );
}
